import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface WriteFileOptions {
  readonly files: ReadonlyArray<{
    readonly filePath: string;
    readonly content: string;
  }>;
}

export interface WriteResult {
  readonly success: boolean;
  readonly writtenPaths: ReadonlyArray<string>;
  readonly error: Error | null;
}

export async function writeFiles(
  options: WriteFileOptions,
): Promise<WriteResult> {
  const { files } = options;
  const writtenPaths: string[] = [];

  try {
    for (const file of files) {
      await mkdir(dirname(file.filePath), { recursive: true });
      await writeFile(file.filePath, file.content, "utf-8");
      writtenPaths.push(file.filePath);
    }

    return { success: true, writtenPaths, error: null };
  } catch (error) {
    return {
      success: false,
      writtenPaths,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
