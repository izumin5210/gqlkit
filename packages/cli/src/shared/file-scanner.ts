import { readdir, stat } from "node:fs/promises";
import { join, matchesGlob, relative, resolve } from "node:path";
import type { Diagnostic } from "../type-extractor/types/index.js";

export interface ScanResult {
  readonly files: ReadonlyArray<string>;
  readonly errors: ReadonlyArray<Diagnostic>;
}

export interface ScanOptions {
  /**
   * Glob patterns to exclude files.
   * Patterns are matched against file paths relative to the scan directory.
   */
  readonly excludeGlobs?: ReadonlyArray<string>;

  /**
   * File paths to exclude (for generated files).
   * Each path is individually excluded from scanning.
   */
  readonly excludePaths?: ReadonlyArray<string>;

  /**
   * Simple suffix patterns to exclude (existing behavior).
   * @deprecated Use excludeGlobs instead
   */
  readonly excludePatterns?: ReadonlyArray<string>;
}

const TS_SOURCE_EXTENSIONS = [".ts", ".cts", ".mts"];
const TS_DEFINITION_SUFFIXES = [".d.ts", ".d.cts", ".d.mts"];

export function isTypeScriptSourceFile(fileName: string): boolean {
  if (TS_DEFINITION_SUFFIXES.some((suffix) => fileName.endsWith(suffix))) {
    return false;
  }
  return TS_SOURCE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

function matchesSuffixPattern(fileName: string, pattern: string): boolean {
  return fileName.endsWith(pattern);
}

function shouldExcludeBySuffix(
  fileName: string,
  excludePatterns: ReadonlyArray<string>,
): boolean {
  return excludePatterns.some((pattern) =>
    matchesSuffixPattern(fileName, pattern),
  );
}

function shouldExcludeByGlobs(
  filePath: string,
  rootDir: string,
  excludeGlobs: ReadonlyArray<string>,
): boolean {
  if (excludeGlobs.length === 0) {
    return false;
  }

  const relativePath = relative(rootDir, filePath);
  return excludeGlobs.some((pattern) => matchesGlob(relativePath, pattern));
}

function shouldExcludeByPaths(
  filePath: string,
  excludePaths: ReadonlyArray<string>,
): boolean {
  return excludePaths.some((excludePath) => filePath === excludePath);
}

interface CollectFilesContext {
  readonly rootDir: string;
  readonly excludePatterns: ReadonlyArray<string>;
  readonly excludeGlobs: ReadonlyArray<string>;
  readonly excludePaths: ReadonlyArray<string>;
}

async function collectFiles(
  directory: string,
  files: string[],
  context: CollectFilesContext,
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        continue;
      }
      await collectFiles(fullPath, files, context);
    } else if (entry.isFile()) {
      if (!isTypeScriptSourceFile(entry.name)) {
        continue;
      }
      if (shouldExcludeBySuffix(entry.name, context.excludePatterns)) {
        continue;
      }
      if (
        shouldExcludeByGlobs(fullPath, context.rootDir, context.excludeGlobs)
      ) {
        continue;
      }
      if (shouldExcludeByPaths(fullPath, context.excludePaths)) {
        continue;
      }
      files.push(fullPath);
    }
  }
}

export async function scanDirectory(
  directory: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const absolutePath = resolve(directory);

  try {
    const stats = await stat(absolutePath);
    if (!stats.isDirectory()) {
      return {
        files: [],
        errors: [
          {
            code: "DIRECTORY_NOT_FOUND",
            message: `Path is not a directory: ${absolutePath}`,
            severity: "error",
            location: null,
          },
        ],
      };
    }
  } catch {
    return {
      files: [],
      errors: [
        {
          code: "DIRECTORY_NOT_FOUND",
          message: `Directory not found: ${absolutePath}`,
          severity: "error",
          location: null,
        },
      ],
    };
  }

  const context: CollectFilesContext = {
    rootDir: absolutePath,
    excludePatterns: options.excludePatterns ?? [],
    excludeGlobs: options.excludeGlobs ?? [],
    excludePaths: options.excludePaths ?? [],
  };

  const files: string[] = [];
  await collectFiles(absolutePath, files, context);

  files.sort();

  return {
    files,
    errors: [],
  };
}
