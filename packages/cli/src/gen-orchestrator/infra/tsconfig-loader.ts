import { existsSync } from "node:fs";
import path from "node:path";
import type { Diagnostic } from "../../core/index.js";
import type * as ts from "../../core/typescript.js";

export interface LoadTsconfigOptions {
  readonly api: ts.API;
  readonly cwd: string;
  readonly tsconfigPath: string | null;
}

export interface LoadTsconfigResult {
  readonly compilerOptions: ts.RawCompilerOptions | null;
  readonly configFilePath: string | null;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export async function loadTsconfig(
  options: LoadTsconfigOptions,
): Promise<LoadTsconfigResult> {
  const { api, cwd, tsconfigPath } = options;

  if (tsconfigPath !== null) {
    return await loadFromSpecifiedPath(api, cwd, tsconfigPath);
  }

  return await autoDetectTsconfig(api, cwd);
}

async function loadFromSpecifiedPath(
  api: ts.API,
  cwd: string,
  tsconfigPath: string,
): Promise<LoadTsconfigResult> {
  const absolutePath = path.isAbsolute(tsconfigPath)
    ? tsconfigPath
    : path.resolve(cwd, tsconfigPath);

  if (!existsSync(absolutePath)) {
    return {
      compilerOptions: null,
      configFilePath: null,
      diagnostics: [
        {
          code: "TSCONFIG_NOT_FOUND",
          message: `tsconfig.json not found at: ${absolutePath}`,
          severity: "error",
          location: null,
        },
      ],
    };
  }

  return await parseConfigFile(api, absolutePath);
}

async function autoDetectTsconfig(
  api: ts.API,
  cwd: string,
): Promise<LoadTsconfigResult> {
  const configPath = findConfigFile(cwd);

  if (!configPath) {
    return {
      compilerOptions: null,
      configFilePath: null,
      diagnostics: [],
    };
  }

  return await parseConfigFile(api, configPath);
}

/**
 * Walks up from `searchPath` looking for a `tsconfig.json`, matching how `tsc`
 * resolves a project when no `-p` is given.
 */
function findConfigFile(searchPath: string): string | null {
  let dir = path.resolve(searchPath);
  while (true) {
    const candidate = path.join(dir, "tsconfig.json");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Renders a diagnostic and its message chain the same way `tsc` prints them:
 * each nested message on its own line, indented two spaces per level.
 */
function flattenDiagnosticText(
  diagnostic: ts.Diagnostic,
  depth: number,
): string {
  const lines = [`${"  ".repeat(depth)}${diagnostic.text}`];
  for (const next of diagnostic.messageChain ?? []) {
    lines.push(flattenDiagnosticText(next, depth + 1));
  }
  return lines.join("\n");
}

async function parseConfigFile(
  api: ts.API,
  configFilePath: string,
): Promise<LoadTsconfigResult> {
  const diagnostics: Diagnostic[] = [];

  const readResult = await api.readConfigFile(configFilePath);

  if (readResult.error) {
    diagnostics.push({
      code: "TSCONFIG_PARSE_ERROR",
      message: `Failed to parse tsconfig.json: ${flattenDiagnosticText(readResult.error, 0)}`,
      severity: "error",
      location: {
        file: configFilePath,
        line: 1,
        column: 1,
      },
    });
    return {
      compilerOptions: null,
      configFilePath: null,
      diagnostics,
    };
  }

  const parseResult = await api.parseJsonConfigFileContent(readResult.config, {
    configFileName: configFilePath,
  });

  // 18003: "No inputs were found in config file". gqlkit passes its own root
  // files to the program, so the project's `include` is irrelevant here.
  const significantErrors = parseResult.errors.filter(
    (error) => error.code !== 18003,
  );

  if (significantErrors.length > 0) {
    for (const error of significantErrors) {
      diagnostics.push({
        code: "TSCONFIG_INVALID",
        message: `Invalid compiler options: ${flattenDiagnosticText(error, 0)}`,
        severity: "error",
        location: {
          file: configFilePath,
          line: 1,
          column: 1,
        },
      });
    }
    return {
      compilerOptions: null,
      configFilePath,
      diagnostics,
    };
  }

  return {
    compilerOptions: parseResult.options,
    configFilePath,
    diagnostics: [],
  };
}
