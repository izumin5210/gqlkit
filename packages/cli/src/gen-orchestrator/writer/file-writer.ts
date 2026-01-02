import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface WriteFileOptions {
  readonly outputDir: string;
  readonly files: ReadonlyArray<{
    readonly filename: string;
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
  const { outputDir, files } = options;
  const writtenPaths: string[] = [];

  try {
    await mkdir(outputDir, { recursive: true });

    for (const file of files) {
      const filePath = join(outputDir, file.filename);
      await writeFile(filePath, file.content, "utf-8");
      writtenPaths.push(filePath);
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
