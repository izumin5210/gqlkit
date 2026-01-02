import { existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { Diagnostic } from "../type-extractor/types/index.js";

export interface LoadTsconfigOptions {
  readonly cwd: string;
  readonly tsconfigPath: string | null;
}

export interface LoadTsconfigResult {
  readonly compilerOptions: ts.CompilerOptions | null;
  readonly configFilePath: string | null;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export function loadTsconfig(options: LoadTsconfigOptions): LoadTsconfigResult {
  const { cwd, tsconfigPath } = options;

  if (tsconfigPath !== null) {
    return loadFromSpecifiedPath(cwd, tsconfigPath);
  }

  return autoDetectTsconfig(cwd);
}

function loadFromSpecifiedPath(
  cwd: string,
  tsconfigPath: string,
): LoadTsconfigResult {
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

  return parseConfigFile(absolutePath);
}

function autoDetectTsconfig(cwd: string): LoadTsconfigResult {
  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, "tsconfig.json");

  if (!configPath) {
    return {
      compilerOptions: null,
      configFilePath: null,
      diagnostics: [],
    };
  }

  return parseConfigFile(configPath);
}

function parseConfigFile(configFilePath: string): LoadTsconfigResult {
  const diagnostics: Diagnostic[] = [];

  const readResult = ts.readConfigFile(configFilePath, ts.sys.readFile);

  if (readResult.error) {
    diagnostics.push({
      code: "TSCONFIG_PARSE_ERROR",
      message: `Failed to parse tsconfig.json: ${ts.flattenDiagnosticMessageText(readResult.error.messageText, "\n")}`,
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

  const configDir = path.dirname(configFilePath);
  const parseResult = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    configDir,
  );

  const significantErrors = parseResult.errors.filter(
    (error) => error.code !== 18003,
  );

  if (significantErrors.length > 0) {
    for (const error of significantErrors) {
      diagnostics.push({
        code: "TSCONFIG_INVALID",
        message: `Invalid compiler options: ${ts.flattenDiagnosticMessageText(error.messageText, "\n")}`,
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
