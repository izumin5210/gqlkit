import type { SourceFile } from "typescript/ast";
import type { Program, Symbol as TsSymbol } from "typescript/async";
import {
  type ExtractDefineApiResult,
  extractResolverDefinitions as extractResolverDefinitionsOfFiles,
} from "../../resolver-extractor/index.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";
import { prefetchDeclarationFacts } from "../../shared/checker-prefetch.js";
import {
  type DirectiveDefinitionExtractionResult,
  extractDirectiveDefinitions,
} from "../../shared/index.js";
import {
  buildScalarMappingTable,
  type ConfigScalarMapping,
  completeTypeExtraction,
  createDeclaredTypesExtraction,
  createRecordedScalarMappingTable,
  type ExtractionOptions,
  type ExtractTypesResult,
  extractDeclaredTypes,
  extractTypesFromProgram,
  finalizeTypeExtraction,
  type GlobalTypeMapping,
  isScalarMappingTableUnread,
  type ScalarBaseTypeMappingTable,
} from "../../type-extractor/index.js";
import {
  type Reply,
  type SliceWorker,
  type SliceWorkerModule,
  startSliceWorker,
} from "./client.js";
import {
  type ResolverDefinitionsSpeculation,
  type ResolverExtractionInputs,
  speculateResolverDefinitions,
} from "./resolver-speculation.js";
import { appendTypeSlice } from "./type-slice.js";

export interface SizedFile {
  readonly path: string;
  readonly bytes: number;
}

/**
 * Splits the files into `count` contiguous, non-empty ranges of nearly equal
 * size, in order; fewer if there are fewer files.
 */
export function partitionFiles(
  files: ReadonlyArray<SizedFile>,
  count: number,
): ReadonlyArray<ReadonlyArray<string>> {
  const rangeCount = Math.min(count, files.length);
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
  const ranges: string[][] = [];
  let start = 0;
  let bytesBefore = 0;
  for (let i = 1; i <= rangeCount; i++) {
    // Leaves at least one file for each remaining range.
    const maxEnd = files.length - (rangeCount - i);
    let end = start + 1;
    let bytes = bytesBefore + (files[start]?.bytes ?? 0);
    while (
      end < maxEnd &&
      (i === rangeCount || bytes < (totalBytes * i) / rangeCount)
    ) {
      bytes += files[end]?.bytes ?? 0;
      end++;
    }
    ranges.push(files.slice(start, end).map((f) => f.path));
    start = end;
    bytesBefore = bytes;
  }
  return ranges;
}

export interface StartSliceExtractionParams {
  readonly workerModule: SliceWorkerModule;
  readonly cwd: string;
  readonly tsconfigPath: string | null;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly slices: ReadonlyArray<ReadonlyArray<string>>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
}

export interface ExtractTypesInSlicesParams {
  readonly program: Program;
  readonly checker: CheckerLoader;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, TsSymbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<TsSymbol, string>;
  readonly customScalarNames: ReadonlyArray<string>;
  readonly configScalars: ReadonlyArray<ConfigScalarMapping>;
  readonly sourceRoot: string | null;
}

/**
 * Type and resolver extraction split into ranges of files: the main thread
 * extracts the first range, and a worker each of the others (see
 * `worker.ts`). Results are combined in file order, so they are the ones
 * extracting all files in sequence gives.
 */
export interface SliceExtraction {
  /** The files whose declarations the main thread prefetches itself. */
  readonly mainThreadFiles: ReadonlyArray<string>;
  readonly extractTypes: (
    params: ExtractTypesInSlicesParams,
  ) => Promise<ExtractTypesResult>;
  /** Must follow `extractTypes`, which extracts them alongside. */
  readonly directiveDefinitions: () => Promise<DirectiveDefinitionExtractionResult>;
  /** Must follow `extractTypes`. */
  readonly extractResolverDefinitions: (
    inputs: ResolverExtractionInputs,
  ) => Promise<ExtractDefineApiResult>;
  readonly terminate: () => Promise<void>;
}

async function getSourceFiles(
  program: Program,
  files: ReadonlyArray<string>,
): Promise<SourceFile[]> {
  const sourceFiles = await Promise.all(
    files.map((file) => program.getSourceFile(file)),
  );
  return sourceFiles.filter((sf) => sf !== undefined);
}

export function startSliceExtraction(
  params: StartSliceExtractionParams,
): SliceExtraction {
  const { workerModule, sourceFiles, slices, globalTypeMappings } = params;
  const [mainThreadFiles = [], ...workerFiles] = slices;
  const workers: SliceWorker[] = workerFiles.map((files) =>
    startSliceWorker({
      module: workerModule,
      data: {
        cwd: params.cwd,
        tsconfigPath: params.tsconfigPath,
        sourceFiles,
        files,
        globalTypeMappings,
      },
    }),
  );
  /** Workers whose types were combined, and are asked about scalars. */
  const workersWithTypes = new Set<SliceWorker>();
  /** Workers that never started, whose ranges the main thread extracts. */
  const unstartedWorkers = new Set<SliceWorker>();
  let mainThreadResolvers: ResolverDefinitionsSpeculation | null = null;
  /** What resolver extraction for unstarted workers' ranges needs. */
  let resolverContext: {
    readonly program: Program;
    readonly checker: CheckerLoader;
    readonly knownTypeSymbols: ReadonlyMap<string, TsSymbol>;
    readonly underlyingSymbolToTypeName: ReadonlyMap<TsSymbol, string>;
    readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  } | null = null;

  const receiveTypes = async (
    worker: SliceWorker,
  ): Promise<Reply<"types"> | null> => {
    try {
      return await worker.receive("types");
    } catch (error) {
      if (worker.hasStarted()) {
        throw error;
      }
      unstartedWorkers.add(worker);
      return null;
    }
  };
  const directiveParts: Array<Promise<DirectiveDefinitionExtractionResult>> =
    [];

  const extractTypes = async (
    typeParams: ExtractTypesInSlicesParams,
  ): Promise<ExtractTypesResult> => {
    const { program, checker } = typeParams;
    const scalarMappingTable = createRecordedScalarMappingTable();
    const options: ExtractionOptions = {
      globalTypeMappings,
      knownTypeNames: typeParams.knownTypeNames,
      knownTypeSymbols: typeParams.knownTypeSymbols,
      underlyingSymbolToTypeName: typeParams.underlyingSymbolToTypeName,
      scalarMappingTable,
    };
    const extraction = createDeclaredTypesExtraction();
    const mainThreadDirectives = extractDirectiveDefinitions({
      program,
      checker,
      sourceFiles: mainThreadFiles,
    });
    // Observed by directiveDefinitions unless type extraction fails first.
    mainThreadDirectives.catch(() => {});
    directiveParts.push(mainThreadDirectives);
    // Resolvers are extracted alongside types: each waits on the checker
    // at times the other can use.
    mainThreadResolvers = speculateResolverDefinitions({
      program,
      checker,
      files: mainThreadFiles,
      sourceFiles,
      globalTypeMappings,
      declaredTypeNames: typeParams.knownTypeNames,
      knownTypeSymbols: typeParams.knownTypeSymbols,
      underlyingSymbolToTypeName: typeParams.underlyingSymbolToTypeName,
    });
    await extractDeclaredTypes({
      program,
      checker,
      files: mainThreadFiles,
      sourceFiles,
      options,
      extraction,
    });

    for (const [i, worker] of workers.entries()) {
      const files = workerFiles[i] ?? [];
      const message = await receiveTypes(worker);
      const directives =
        message === null
          ? extractDirectiveDefinitions({
              program,
              checker,
              sourceFiles: files,
            })
          : Promise.resolve(message.directives);
      directives.catch(() => {});
      directiveParts.push(directives);
      if (message !== null && appendTypeSlice(extraction, message.result)) {
        workersWithTypes.add(worker);
        continue;
      }
      await prefetchDeclarationFacts(
        checker,
        await getSourceFiles(program, files),
      );
      await extractDeclaredTypes({
        program,
        checker,
        files,
        sourceFiles,
        options,
        extraction,
      });
    }
    const firstPass = await completeTypeExtraction({
      checker,
      sourceFiles,
      options,
      extraction,
    });

    const { detectedScalars } = firstPass;
    const actualScalarMappingTable =
      detectedScalars.length > 0
        ? await buildScalarMappingTable({ detectedScalars, checker, program })
        : null;
    let scalarMappingTableUnread = isScalarMappingTableUnread(
      scalarMappingTable,
      actualScalarMappingTable,
    );
    if (actualScalarMappingTable !== null) {
      for (const worker of workersWithTypes) {
        worker.send({ kind: "check-scalar-reads", detectedScalars });
      }
      for (const worker of workersWithTypes) {
        const { unread } = await worker.receive("scalar-reads");
        scalarMappingTableUnread &&= unread;
      }
    }

    let extractionResult = firstPass;
    if (!scalarMappingTableUnread) {
      // Field types that are scalar base types map to the scalars: extract
      // everything again with the table. Rare enough to do here alone.
      await prefetchDeclarationFacts(
        checker,
        await getSourceFiles(program, sourceFiles),
      );
      extractionResult = await extractTypesFromProgram({
        program,
        checker,
        sourceFiles,
        options: { ...options, scalarMappingTable: actualScalarMappingTable },
      });
    }

    resolverContext = {
      program,
      checker,
      knownTypeSymbols: typeParams.knownTypeSymbols,
      underlyingSymbolToTypeName: typeParams.underlyingSymbolToTypeName,
      scalarMappingTable: actualScalarMappingTable,
    };
    return finalizeTypeExtraction({
      extractionResult,
      scalarMappingTable: actualScalarMappingTable,
      customScalarNames: typeParams.customScalarNames,
      configScalars: typeParams.configScalars,
      sourceRoot: typeParams.sourceRoot,
    });
  };

  const extractResolverDefinitions = async (
    inputs: ResolverExtractionInputs,
  ): Promise<ExtractDefineApiResult> => {
    if (mainThreadResolvers === null || resolverContext === null) {
      throw new Error("resolvers are extracted after types");
    }
    const context = resolverContext;
    const startedWorkers = workers.filter((w) => !unstartedWorkers.has(w));
    for (const worker of startedWorkers) {
      worker.send({ kind: "resolvers", inputs });
    }
    const parts = [await mainThreadResolvers.settle(inputs)];
    for (const [i, worker] of workers.entries()) {
      parts.push(
        unstartedWorkers.has(worker)
          ? await extractResolverDefinitionsOfFiles({
              ...context,
              files: workerFiles[i] ?? [],
              sourceFiles,
              globalTypeMappings,
              knownTypeNames: new Set(inputs.knownTypeNames),
            })
          : (await worker.receive("definitions")).definitions,
      );
    }
    return {
      resolvers: parts.flatMap((p) => p.resolvers),
      abstractTypeResolvers: parts.flatMap((p) => p.abstractTypeResolvers),
      diagnostics: parts.flatMap((p) => p.diagnostics),
    };
  };

  const directiveDefinitions =
    async (): Promise<DirectiveDefinitionExtractionResult> => {
      const parts = await Promise.all(directiveParts);
      return {
        definitions: parts.flatMap((p) => p.definitions),
        errors: parts.flatMap((p) => p.errors),
      };
    };

  return {
    mainThreadFiles,
    extractTypes,
    directiveDefinitions,
    extractResolverDefinitions,
    terminate: async () => {
      await Promise.all(workers.map((w) => w.terminate()));
    },
  };
}
