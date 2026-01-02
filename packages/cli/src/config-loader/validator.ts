import type { Diagnostic } from "../type-extractor/types/index.js";
import {
  DEFAULT_AST_OUTPUT_PATH,
  DEFAULT_SDL_OUTPUT_PATH,
  type ResolvedConfig,
  type ResolvedOutputConfig,
  type ResolvedScalarMapping,
} from "./loader.js";

export interface ValidateConfigOptions {
  readonly config: unknown;
  readonly configPath: string;
}

export interface ValidateConfigResult {
  readonly valid: boolean;
  readonly resolvedConfig: ResolvedConfig | undefined;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const BUILTIN_SCALAR_NAMES = [
  "ID",
  "String",
  "Int",
  "Float",
  "Boolean",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateOutputPath(
  value: unknown,
  fieldName: string,
  configPath: string,
): { resolved: string | null; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  if (value === undefined) {
    const defaultPath =
      fieldName === "output.ast"
        ? DEFAULT_AST_OUTPUT_PATH
        : DEFAULT_SDL_OUTPUT_PATH;
    return { resolved: defaultPath, diagnostics: [] };
  }

  if (value === null) {
    return { resolved: null, diagnostics: [] };
  }

  if (typeof value !== "string") {
    diagnostics.push({
      code: "CONFIG_INVALID_OUTPUT_TYPE",
      message: `${fieldName} must be a string, null, or undefined`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { resolved: null, diagnostics };
  }

  if (value === "") {
    diagnostics.push({
      code: "CONFIG_INVALID_OUTPUT_PATH",
      message: `${fieldName} path cannot be empty`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { resolved: null, diagnostics };
  }

  return { resolved: value, diagnostics: [] };
}

function validateOutputConfig(
  output: unknown,
  configPath: string,
): { resolved: ResolvedOutputConfig | undefined; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  if (output === undefined) {
    return {
      resolved: {
        ast: DEFAULT_AST_OUTPUT_PATH,
        sdl: DEFAULT_SDL_OUTPUT_PATH,
      },
      diagnostics: [],
    };
  }

  if (!isRecord(output)) {
    diagnostics.push({
      code: "CONFIG_INVALID_TYPE",
      message: "output must be an object",
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { resolved: undefined, diagnostics };
  }

  const astResult = validateOutputPath(output["ast"], "output.ast", configPath);
  const sdlResult = validateOutputPath(output["sdl"], "output.sdl", configPath);

  diagnostics.push(...astResult.diagnostics);
  diagnostics.push(...sdlResult.diagnostics);

  if (diagnostics.length > 0) {
    return { resolved: undefined, diagnostics };
  }

  return {
    resolved: {
      ast: astResult.resolved,
      sdl: sdlResult.resolved,
    },
    diagnostics: [],
  };
}

function validateScalarMapping(
  scalar: unknown,
  index: number,
  configPath: string,
): { resolved: ResolvedScalarMapping | undefined; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  if (!isRecord(scalar)) {
    diagnostics.push({
      code: "CONFIG_INVALID_TYPE",
      message: `scalars[${index}] must be an object`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { resolved: undefined, diagnostics };
  }

  if (typeof scalar["graphqlName"] !== "string") {
    diagnostics.push({
      code: "CONFIG_MISSING_PROPERTY",
      message: `scalars[${index}].graphqlName is required and must be a string`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
  }

  if (!isRecord(scalar["type"])) {
    diagnostics.push({
      code: "CONFIG_MISSING_PROPERTY",
      message: `scalars[${index}].type is required and must be an object`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { resolved: undefined, diagnostics };
  }

  const type = scalar["type"];

  if (typeof type["from"] !== "string") {
    diagnostics.push({
      code: "CONFIG_MISSING_PROPERTY",
      message: `scalars[${index}].type.from is required and must be a string`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
  }

  if (typeof type["name"] !== "string") {
    diagnostics.push({
      code: "CONFIG_MISSING_PROPERTY",
      message: `scalars[${index}].type.name is required and must be a string`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
  }

  if (diagnostics.length > 0) {
    return { resolved: undefined, diagnostics };
  }

  const graphqlName = scalar["graphqlName"] as string;

  if (
    BUILTIN_SCALAR_NAMES.includes(
      graphqlName as (typeof BUILTIN_SCALAR_NAMES)[number],
    )
  ) {
    diagnostics.push({
      code: "CONFIG_BUILTIN_OVERRIDE",
      message: `Cannot override built-in scalar '${graphqlName}'. Built-in scalars: ID, String, Int, Float, Boolean`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { resolved: undefined, diagnostics };
  }

  return {
    resolved: {
      graphqlName,
      typeName: type["name"] as string,
      importPath: type["from"] as string,
    },
    diagnostics,
  };
}

export function validateConfig(
  options: ValidateConfigOptions,
): ValidateConfigResult {
  const { config, configPath } = options;
  const diagnostics: Diagnostic[] = [];

  if (!isRecord(config)) {
    diagnostics.push({
      code: "CONFIG_INVALID_TYPE",
      message: "Config must be an object",
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { valid: false, resolvedConfig: undefined, diagnostics };
  }

  const outputResult = validateOutputConfig(config["output"], configPath);
  diagnostics.push(...outputResult.diagnostics);

  if (config["scalars"] !== undefined && !Array.isArray(config["scalars"])) {
    diagnostics.push({
      code: "CONFIG_INVALID_TYPE",
      message: "scalars must be an array",
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { valid: false, resolvedConfig: undefined, diagnostics };
  }

  const scalarsArray = config["scalars"] ?? [];
  const resolvedScalars: ResolvedScalarMapping[] = [];
  const seenGraphqlNames = new Map<string, number>();
  const seenTypes = new Map<string, { index: number; names: string[] }>();

  for (let i = 0; i < scalarsArray.length; i++) {
    const scalar = scalarsArray[i];
    const result = validateScalarMapping(scalar, i, configPath);
    diagnostics.push(...result.diagnostics);

    if (result.resolved) {
      const { graphqlName, typeName, importPath } = result.resolved;

      const existingGraphqlIndex = seenGraphqlNames.get(graphqlName);
      if (existingGraphqlIndex !== undefined) {
        diagnostics.push({
          code: "CONFIG_DUPLICATE_MAPPING",
          message: `Duplicate scalar mapping: '${graphqlName}' is defined multiple times`,
          severity: "error",
          location: { file: configPath, line: 1, column: 1 },
        });
      } else {
        seenGraphqlNames.set(graphqlName, i);
      }

      const typeKey = `${importPath}::${typeName}`;
      const existingType = seenTypes.get(typeKey);
      if (existingType) {
        existingType.names.push(graphqlName);
        diagnostics.push({
          code: "CONFIG_DUPLICATE_TYPE",
          message: `Type '${typeName}' from '${importPath}' is mapped to multiple scalars: ${existingType.names.join(", ")}`,
          severity: "error",
          location: { file: configPath, line: 1, column: 1 },
        });
      } else {
        seenTypes.set(typeKey, { index: i, names: [graphqlName] });
      }

      if (diagnostics.length === 0) {
        resolvedScalars.push(result.resolved);
      }
    }
  }

  if (diagnostics.length > 0 || !outputResult.resolved) {
    return { valid: false, resolvedConfig: undefined, diagnostics };
  }

  return {
    valid: true,
    resolvedConfig: {
      scalars: resolvedScalars,
      output: outputResult.resolved,
    },
    diagnostics: [],
  };
}
