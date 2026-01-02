import ts from "typescript";
import type { Diagnostic } from "../type-extractor/types/index.js";
import { loadTsconfig } from "./tsconfig-loader.js";

const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.Node16,
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  noEmit: true,
};

export interface CreateSharedProgramOptions {
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
  const { cwd, tsconfigPath, typeFiles, resolverFiles } = options;

  const tsconfigResult = loadTsconfig({ cwd, tsconfigPath });

  if (tsconfigResult.diagnostics.length > 0) {
    return {
      program: null,
      diagnostics: tsconfigResult.diagnostics,
    };
  }

  const compilerOptions: ts.CompilerOptions =
    tsconfigResult.compilerOptions ?? DEFAULT_COMPILER_OPTIONS;

  const allFiles = [...typeFiles, ...resolverFiles];
  const program = ts.createProgram(allFiles, compilerOptions);

  return {
    program,
    diagnostics: [],
  };
}
