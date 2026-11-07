import { ScriptTarget, type SourceFile } from "typescript/ast";
import {
  type API,
  ModuleKind,
  ModuleResolutionKind,
  type Program,
  type RawCompilerOptions,
} from "typescript/async";
import type { Diagnostic } from "../../core/index.js";
import { loadTsconfig } from "./tsconfig-loader.js";

const DEFAULT_COMPILER_OPTIONS: RawCompilerOptions = {
  target: ScriptTarget.ES2022,
  module: ModuleKind.NodeNext,
  moduleResolution: ModuleResolutionKind.Node16,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
};

export interface CreateSharedProgramOptions {
  readonly api: API;
  readonly cwd: string;
  readonly tsconfigPath: string | null;
  readonly typeFiles: ReadonlyArray<string>;
  readonly resolverFiles: ReadonlyArray<string>;
}

export interface CreateSharedProgramResult {
  readonly program: Program | null;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export async function createSharedProgram(
  options: CreateSharedProgramOptions,
): Promise<CreateSharedProgramResult> {
  const { api, cwd, tsconfigPath, typeFiles, resolverFiles } = options;

  const tsconfigResult = await loadTsconfig({ api, cwd, tsconfigPath });

  if (tsconfigResult.diagnostics.length > 0) {
    return {
      program: null,
      diagnostics: tsconfigResult.diagnostics,
    };
  }

  const compilerOptions =
    tsconfigResult.compilerOptions ?? DEFAULT_COMPILER_OPTIONS;

  const allFiles = [...typeFiles, ...resolverFiles];
  const program = await api.createProgram(allFiles, compilerOptions);

  return {
    program,
    diagnostics: [],
  };
}

/**
 * Files per request when fetching source files. One request for every file
 * of a large project makes tsc encode, and the client decode, a single
 * message of tens of megabytes; requests of this size are handled
 * concurrently and decoded as they arrive.
 */
const SOURCE_FILES_PER_REQUEST = 100;

export interface FetchSourceFilesParams {
  readonly api: API;
  readonly program: Program;
  readonly files: ReadonlyArray<string>;
}

/** Fetches the files' syntax trees, in the order of `files`. */
export async function fetchSourceFiles(
  params: FetchSourceFilesParams,
): Promise<ReadonlyArray<SourceFile | undefined>> {
  const { api, program, files } = params;
  const requests: Promise<SourceFile | undefined>[] = [];
  for (let i = 0; i < files.length; i += SOURCE_FILES_PER_REQUEST) {
    // Fetches issued inside one batch context travel as one request.
    using _batch = api.batchContext();
    for (const file of files.slice(i, i + SOURCE_FILES_PER_REQUEST)) {
      requests.push(program.getSourceFile(file));
    }
  }
  return Promise.all(requests);
}
