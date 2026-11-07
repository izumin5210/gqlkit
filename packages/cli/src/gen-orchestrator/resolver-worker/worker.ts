/**
 * Worker thread entry: extracts resolver definitions with its own TypeScript
 * API instance while the main thread extracts types.
 *
 * Both threads spend most of their time encoding, decoding and dispatching
 * checker queries, which the TypeScript 7 client does on the thread that
 * issues them. Splitting the stages over two threads, each talking to its own
 * tsc process, runs that work in parallel.
 */

import { once } from "node:events";
import { parentPort, workerData } from "node:worker_threads";
import { API } from "typescript/async";
import { createCheckerLoader } from "../../shared/checker-loader.js";
import { collectDeclaredTypeNames } from "../../type-extractor/index.js";
import { createSharedProgram } from "../infra/program-factory.js";
import type {
  ResolverWorkerData,
  ResolverWorkerRequest,
  ResolverWorkerResponse,
} from "./protocol.js";
import { speculateResolverDefinitions } from "./speculation.js";

const port = parentPort;
if (port === null) {
  throw new Error("resolver worker must run in a worker thread");
}
const data = workerData as ResolverWorkerData;

function respond(response: ResolverWorkerResponse): void {
  port?.postMessage(response);
}

async function run(): Promise<void> {
  await using api = new API({ cwd: data.cwd });
  const { program } = await createSharedProgram({
    api,
    cwd: data.cwd,
    tsconfigPath: data.tsconfigPath,
    typeFiles: data.sourceFiles,
    resolverFiles: data.sourceFiles,
  });
  if (program === null) {
    respond({ kind: "definitions", definitions: null });
    return;
  }
  const loadedFiles = await Promise.all(
    data.sourceFiles.map((file) => program.getSourceFile(file)),
  );
  const checker = createCheckerLoader({
    api,
    checker: program.getProject().checker,
    loadedFilePaths: new Set(
      loadedFiles.flatMap((sf) => (sf === undefined ? [] : [sf.path])),
    ),
  });
  const names = await collectDeclaredTypeNames({
    program,
    checker,
    sourceFiles: data.sourceFiles,
  });
  const speculation = speculateResolverDefinitions({
    program,
    checker,
    sourceFiles: data.sourceFiles,
    globalTypeMappings: data.globalTypeMappings,
    declaredTypeNames: names.typeNames,
    knownTypeSymbols: names.typeSymbols,
    underlyingSymbolToTypeName: names.underlyingSymbolToTypeName,
  });
  const [inputs] = (await once(
    port as NonNullable<typeof port>,
    "message",
  )) as [ResolverWorkerRequest];
  respond({
    kind: "definitions",
    definitions: await speculation.settle(inputs),
  });
}

try {
  await run();
} catch (error) {
  respond({ kind: "error", error });
}
