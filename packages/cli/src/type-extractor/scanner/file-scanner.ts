import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Diagnostic } from "../types/index.js";

export interface ScanResult {
  readonly files: ReadonlyArray<string>;
  readonly errors: ReadonlyArray<Diagnostic>;
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
      if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        files.push(fullPath);
      }
    }
  }
}

export async function scanDirectory(directory: string): Promise<ScanResult> {
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
