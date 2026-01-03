import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Diagnostic } from "../type-extractor/types/index.js";

export interface ScanResult {
  readonly files: ReadonlyArray<string>;
  readonly errors: ReadonlyArray<Diagnostic>;
}

export interface ScanOptions {
  readonly excludePatterns?: ReadonlyArray<string>;
}

function isTypeScriptFile(fileName: string): boolean {
  return fileName.endsWith(".ts");
}

function isTypeDefinitionFile(fileName: string): boolean {
  return fileName.endsWith(".d.ts");
}

function matchesPattern(fileName: string, pattern: string): boolean {
  return fileName.endsWith(pattern);
}

function shouldExcludeFile(
  fileName: string,
  excludePatterns: ReadonlyArray<string>,
): boolean {
  return excludePatterns.some((pattern) => matchesPattern(fileName, pattern));
}

async function collectFiles(
  directory: string,
  files: string[],
  options: ScanOptions,
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  const excludePatterns = options.excludePatterns ?? [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        continue;
      }
      await collectFiles(fullPath, files, options);
    } else if (entry.isFile()) {
      if (
        isTypeScriptFile(entry.name) &&
        !isTypeDefinitionFile(entry.name) &&
        !shouldExcludeFile(entry.name, excludePatterns)
      ) {
        files.push(fullPath);
      }
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

  const files: string[] = [];
  await collectFiles(absolutePath, files, options);

  files.sort();

  return {
    files,
    errors: [],
  };
}
