import { existsSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { loadConfig } from "../config-loader/index.js";

export interface ResolveDirectoryOptions {
  readonly cwd: string;
  readonly dir: string | null;
}

export interface ResolvedDirectories {
  readonly projectDir: string;
  readonly gqlkitDir: string;
  readonly schemaDir: string;
}

export interface InitDiagnostic {
  readonly code: "INIT_PROJECT_NOT_FOUND" | "INIT_PACKAGE_JSON_NOT_FOUND";
  readonly message: string;
  readonly severity: "error" | "warning" | "info";
  readonly location: null;
}

export interface ResolveDirectoryResult {
  readonly directories: ResolvedDirectories | null;
  readonly diagnostics: ReadonlyArray<InitDiagnostic>;
}

const CONFIG_FILE_NAME = "gqlkit.config.ts";
const PACKAGE_JSON = "package.json";

function findProjectRoot(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    const packageJsonPath = join(currentDir, PACKAGE_JSON);
    const configPath = join(currentDir, CONFIG_FILE_NAME);

    if (existsSync(packageJsonPath) || existsSync(configPath)) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

function hasPackageJson(dir: string): boolean {
  return existsSync(join(dir, PACKAGE_JSON));
}

export async function resolveProjectDirectory(
  options: ResolveDirectoryOptions,
): Promise<ResolveDirectoryResult> {
  let projectDir: string;

  if (options.dir !== null) {
    projectDir = isAbsolute(options.dir)
      ? options.dir
      : join(options.cwd, options.dir);

    if (!hasPackageJson(projectDir)) {
      return {
        directories: null,
        diagnostics: [
          {
            code: "INIT_PACKAGE_JSON_NOT_FOUND",
            message: `package.json not found in ${projectDir}`,
            severity: "error",
            location: null,
          },
        ],
      };
    }
  } else {
    const foundDir = findProjectRoot(options.cwd);
    if (foundDir === null) {
      return {
        directories: null,
        diagnostics: [
          {
            code: "INIT_PROJECT_NOT_FOUND",
            message:
              "Could not find project directory. No package.json or gqlkit.config.ts found in current directory or any parent directory.",
            severity: "error",
            location: null,
          },
        ],
      };
    }
    projectDir = foundDir;

    if (!hasPackageJson(projectDir)) {
      return {
        directories: null,
        diagnostics: [
          {
            code: "INIT_PACKAGE_JSON_NOT_FOUND",
            message: `package.json not found in ${projectDir}`,
            severity: "error",
            location: null,
          },
        ],
      };
    }
  }

  const configResult = await loadConfig({ cwd: projectDir });

  const sourceDir =
    configResult.configPath !== undefined
      ? configResult.config.sourceDir
      : "src/gqlkit/schema";

  const schemaDir = join(projectDir, sourceDir);
  const gqlkitDir = dirname(schemaDir);

  return {
    directories: {
      projectDir,
      gqlkitDir,
      schemaDir,
    },
    diagnostics: [],
  };
}
