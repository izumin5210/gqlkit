import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface DetectExistingProjectOptions {
  readonly gqlkitDir: string;
  readonly schemaDir: string;
}

export interface DetectExistingProjectResult {
  readonly hasExistingSetup: boolean;
  readonly detectedFiles: ReadonlyArray<string>;
}

const TYPESCRIPT_EXTENSIONS = [".ts", ".mts", ".cts"];
const CREATE_GQLKIT_APIS_PATTERN = /createGqlkitApis/;

function isTypeScriptFile(fileName: string): boolean {
  return TYPESCRIPT_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

function scanDirectoryForPattern(dir: string, pattern: RegExp): string[] {
  const detectedFiles: string[] = [];

  if (!existsSync(dir)) {
    return detectedFiles;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isFile() && isTypeScriptFile(entry)) {
      const content = readFileSync(fullPath, "utf-8");
      if (pattern.test(content)) {
        detectedFiles.push(fullPath);
      }
    }
  }

  return detectedFiles;
}

export async function detectExistingProject(
  options: DetectExistingProjectOptions,
): Promise<DetectExistingProjectResult> {
  const { gqlkitDir, schemaDir } = options;

  const detectedFiles: string[] = [];

  const gqlkitDirFiles = scanDirectoryForPattern(
    gqlkitDir,
    CREATE_GQLKIT_APIS_PATTERN,
  );
  detectedFiles.push(...gqlkitDirFiles);

  if (schemaDir !== gqlkitDir) {
    const schemaDirFiles = scanDirectoryForPattern(
      schemaDir,
      CREATE_GQLKIT_APIS_PATTERN,
    );
    detectedFiles.push(...schemaDirFiles);
  }

  return {
    hasExistingSetup: detectedFiles.length > 0,
    detectedFiles,
  };
}
