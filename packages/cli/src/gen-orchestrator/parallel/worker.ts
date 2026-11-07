/**
 * Worker thread entry: extracts the types and resolvers of a range of files
 * with its own TypeScript API instance, alongside the main thread and the
 * other workers.
 *
 * The TypeScript 7 client encodes, decodes and dispatches every checker
 * query on the thread that issues it, and that is where most of the
 * extraction time goes. Ranges of files extracted on separate threads, each
 * talking to its own tsc process, run that work in parallel.
 *
 * The worker extracts before the files preceding its range are: it assumes
 * they register no discovered types, that no scalar base type mapping
 * applies, and that type extraction discovers no types the resolvers
 * reference, and records what it read of each. The main thread checks those
 * reads against the actual answers and redoes whatever they would change.
 */

import { on } from "node:events";
import { parentPort, workerData } from "node:worker_threads";
import { API } from "typescript/async";
import { createCheckerLoader } from "../../shared/checker-loader.js";
import { prefetchDeclarationFacts } from "../../shared/checker-prefetch.js";
import { extractDirectiveDefinitions } from "../../shared/index.js";
import {
  buildScalarMappingTable,
  collectDeclaredTypeNames,
  createRecordedScalarMappingTable,
  isScalarMappingTableUnread,
} from "../../type-extractor/index.js";
import {
  createSharedProgram,
  fetchSourceFiles,
} from "../infra/program-factory.js";
import type {
  SliceWorkerData,
  SliceWorkerRequest,
  SliceWorkerResponse,
} from "./protocol.js";
import { speculateResolverDefinitions } from "./resolver-speculation.js";
import { extractTypeSlice } from "./type-slice.js";

if (parentPort === null) {
  throw new Error("the slice worker must run in a worker thread");
}
const port = parentPort;
const data = workerData as SliceWorkerData;

function respond(response: SliceWorkerResponse): void {
  port.postMessage(response);
}

async function run(): Promise<void> {
  const { cwd, tsconfigPath, sourceFiles, files, globalTypeMappings } = data;
  await using api = new API({ cwd });
  const { program } = await createSharedProgram({
    api,
    cwd,
    tsconfigPath,
    typeFiles: sourceFiles,
    resolverFiles: sourceFiles,
  });
  if (program === null) {
    throw new Error("the slice worker could not create the program");
  }
  const loadedFiles = await fetchSourceFiles({
    api,
    program,
    files: sourceFiles,
  });
  const checker = createCheckerLoader({
    api,
    checker: program.getProject().checker,
    loadedFilePaths: new Set(
      loadedFiles.flatMap((sf) => (sf === undefined ? [] : [sf.path])),
    ),
  });
  const filesInRange = new Set(files);
  const [names] = await Promise.all([
    collectDeclaredTypeNames({ program, checker, sourceFiles }),
    prefetchDeclarationFacts(
      checker,
      loadedFiles.flatMap((sf, i) =>
        sf !== undefined && filesInRange.has(sourceFiles[i] ?? "") ? [sf] : [],
      ),
    ),
  ]);

  const resolvers = speculateResolverDefinitions({
    program,
    checker,
    files,
    sourceFiles,
    globalTypeMappings,
    declaredTypeNames: names.typeNames,
    knownTypeSymbols: names.typeSymbols,
    underlyingSymbolToTypeName: names.underlyingSymbolToTypeName,
  });

  const directives = extractDirectiveDefinitions({
    program,
    checker,
    sourceFiles: files,
  });
  const scalarMappingTable = createRecordedScalarMappingTable();
  respond({
    kind: "types",
    result: await extractTypeSlice({
      program,
      checker,
      files,
      sourceFiles,
      options: {
        globalTypeMappings,
        knownTypeNames: names.typeNames,
        knownTypeSymbols: names.typeSymbols,
        underlyingSymbolToTypeName: names.underlyingSymbolToTypeName,
        scalarMappingTable,
      },
      priorRegisteredNames: new Set(),
    }),
    directives: await directives,
  });

  for await (const [request] of on(port, "message") as AsyncIterable<
    [SliceWorkerRequest]
  >) {
    switch (request.kind) {
      case "check-scalar-reads":
        respond({
          kind: "scalar-reads",
          unread: isScalarMappingTableUnread(
            scalarMappingTable,
            request.detectedScalars.length > 0
              ? await buildScalarMappingTable({
                  detectedScalars: request.detectedScalars,
                  checker,
                  program,
                })
              : null,
          ),
        });
        break;
      case "resolvers":
        respond({
          kind: "definitions",
          definitions: await resolvers.settle(request.inputs),
        });
        return;
    }
  }
}

respond({ kind: "ready" });
try {
  await run();
} catch (error) {
  respond({ kind: "error", error });
}
