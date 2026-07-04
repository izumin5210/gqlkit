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

/**
 * Module-level cache of parsed `node_modules` SourceFiles (TypeScript's bundled
 * `lib.*.d.ts` files and dependency `.d.ts` declarations), shared across every
 * `createSharedProgram` call made in this process.
 *
 * Why this is safe: `node_modules` contents never change while a process is running, so
 * parsing the same file under the same effective (languageVersion, impliedNodeFormat)
 * settings always yields an equivalent AST. Caching keyed on those values can never observe
 * a stale file.
 *
 * What this speeds up: the golden-file test suite (`golden.test.ts`) builds ~226 fresh
 * `ts.Program`s in one process; without this cache, each one re-reads and re-parses the same
 * standard-lib and dependency `.d.ts` files from disk. In the production CLI, only one
 * program is ever created per process, so the cache is populated once and never reused across
 * programs there — it is inert beyond the cost of a Map lookup per file.
 *
 * Only `node_modules` paths are cached: testdata/user source files differ per golden case and
 * must always be re-read, so they never enter this cache.
 */
const nodeModulesSourceFileCache = new Map<string, ts.SourceFile>();

function isNodeModulesPath(fileName: string): boolean {
  return (
    fileName.includes("/node_modules/") || fileName.includes("\\node_modules\\")
  );
}

interface SourceFileCacheKeyParams {
  readonly fileName: string;
  readonly languageVersionOrOptions:
    | ts.ScriptTarget
    | ts.CreateSourceFileOptions;
}

// The cache key must cover everything that affects parsing, not just the file path: under
// `moduleResolution: node16`/`nodenext` (used by this repo), TypeScript derives a per-file
// `impliedNodeFormat` that changes how the parser treats module syntax, and `languageVersion`
// can differ across programs built from different tsconfig.json files (e.g. testdata cases
// with a custom `target`). Both must be part of the key alongside the file name.
function buildSourceFileCacheKey(params: SourceFileCacheKeyParams): string {
  const { fileName, languageVersionOrOptions } = params;
  const languageVersion =
    typeof languageVersionOrOptions === "object"
      ? languageVersionOrOptions.languageVersion
      : languageVersionOrOptions;
  const impliedNodeFormat =
    typeof languageVersionOrOptions === "object"
      ? (languageVersionOrOptions.impliedNodeFormat ?? null)
      : null;
  return `${fileName}::${languageVersion}::${impliedNodeFormat}`;
}

function createCachingCompilerHost(
  compilerOptions: ts.CompilerOptions,
): ts.CompilerHost {
  const host = ts.createCompilerHost(compilerOptions);
  const readSourceFile = host.getSourceFile.bind(host);

  host.getSourceFile = (
    fileName,
    languageVersionOrOptions,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    if (!isNodeModulesPath(fileName)) {
      return readSourceFile(
        fileName,
        languageVersionOrOptions,
        onError,
        shouldCreateNewSourceFile,
      );
    }

    const cacheKey = buildSourceFileCacheKey({
      fileName,
      languageVersionOrOptions,
    });

    // A true `shouldCreateNewSourceFile` means the caller has a specific reason to distrust
    // any previously created SourceFile for this key; bypass the cache and refresh it.
    if (!shouldCreateNewSourceFile) {
      const cached = nodeModulesSourceFileCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    const sourceFile = readSourceFile(
      fileName,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile,
    );

    if (sourceFile !== undefined) {
      nodeModulesSourceFileCache.set(cacheKey, sourceFile);
    }

    return sourceFile;
  };

  return host;
}

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
  const program = ts.createProgram(
    allFiles,
    compilerOptions,
    createCachingCompilerHost(compilerOptions),
  );

  return {
    program,
    diagnostics: [],
  };
}
