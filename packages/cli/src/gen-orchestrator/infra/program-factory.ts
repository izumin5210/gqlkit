import type { Diagnostic } from "../../core/index.js";
import * as ts from "../../core/typescript.js";
import { loadTsconfig } from "./tsconfig-loader.js";

const DEFAULT_COMPILER_OPTIONS: ts.RawCompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.Node16,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
};

export interface CreateSharedProgramOptions {
  readonly api: ts.API;
  readonly cwd: string;
  readonly tsconfigPath: string | null;
  readonly typeFiles: ReadonlyArray<string>;
  readonly resolverFiles: ReadonlyArray<string>;
}

export interface CreateSharedProgramResult {
  readonly program: ts.Program | null;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export function createSharedProgram(
  options: CreateSharedProgramOptions,
): CreateSharedProgramResult {
  const { api, cwd, tsconfigPath, typeFiles, resolverFiles } = options;

  const tsconfigResult = loadTsconfig({ api, cwd, tsconfigPath });

  if (tsconfigResult.diagnostics.length > 0) {
    return {
      program: null,
      diagnostics: tsconfigResult.diagnostics,
    };
  }

  const compilerOptions =
    tsconfigResult.compilerOptions ?? DEFAULT_COMPILER_OPTIONS;

  const allFiles = [...typeFiles, ...resolverFiles];
  const program = api.createProgram(allFiles, compilerOptions);

  return {
    program,
    diagnostics: [],
  };
}
