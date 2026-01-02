import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Diagnostic } from "../../type-extractor/types/index.js";

export interface ScanResult {
  readonly files: ReadonlyArray<string>;
  readonly errors: ReadonlyArray<Diagnostic>;
}

function isTestFile(fileName: string): boolean {
  return fileName.endsWith(".test.ts") || fileName.endsWith(".spec.ts");
}

function isTypeDefinitionFile(fileName: string): boolean {
  return fileName.endsWith(".d.ts");
}

function isTypeScriptFile(fileName: string): boolean {
  return fileName.endsWith(".ts");
}

async function collectFiles(directory: string, files: string[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        continue;
      }
      await collectFiles(fullPath, files);
    } else if (entry.isFile()) {
      if (
        isTypeScriptFile(entry.name) &&
        !isTypeDefinitionFile(entry.name) &&
        !isTestFile(entry.name)
      ) {
        files.push(fullPath);
      }
    }
  }
}

export async function scanResolverDirectory(
  directory: string,
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
  await collectFiles(absolutePath, files);

  files.sort();

  return {
    files,
    errors: [],
  };
}
