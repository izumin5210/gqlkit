import type { Diagnostic } from "../type-extractor/types/index.js";
import {
  DEFAULT_RESOLVERS_PATH,
  DEFAULT_SCHEMA_PATH,
  DEFAULT_SOURCE_DIR,
  DEFAULT_TYPEDEFS_PATH,
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

function getDefaultPathForField(fieldName: string): string {
  switch (fieldName) {
    case "output.resolversPath":
      return DEFAULT_RESOLVERS_PATH;
    case "output.typeDefsPath":
      return DEFAULT_TYPEDEFS_PATH;
    case "output.schemaPath":
      return DEFAULT_SCHEMA_PATH;
    default:
      return "";
  }
}

function validateOutputPath(
  value: unknown,
  fieldName: string,
  configPath: string,
): { resolved: string | null; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  if (value === undefined) {
    const defaultPath = getDefaultPathForField(fieldName);
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

function validateSourceDir(
  value: unknown,
  configPath: string,
): { resolved: string | undefined; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  if (value === undefined) {
    return { resolved: DEFAULT_SOURCE_DIR, diagnostics: [] };
  }

  if (typeof value !== "string") {
    diagnostics.push({
      code: "CONFIG_INVALID_TYPE",
      message: "sourceDir must be a string",
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { resolved: undefined, diagnostics };
  }

  if (value === "") {
    diagnostics.push({
      code: "CONFIG_INVALID_SOURCE_DIR",
      message: "sourceDir cannot be empty",
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { resolved: undefined, diagnostics };
  }

  return { resolved: value, diagnostics: [] };
}

function validateSourceIgnoreGlobs(
  value: unknown,
  configPath: string,
): { resolved: ReadonlyArray<string> | undefined; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  if (value === undefined) {
    return { resolved: [], diagnostics: [] };
  }

  if (!Array.isArray(value)) {
    diagnostics.push({
      code: "CONFIG_INVALID_IGNORE_GLOBS",
      message: "sourceIgnoreGlobs must be an array of strings",
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { resolved: undefined, diagnostics };
  }

  for (const item of value) {
    if (typeof item !== "string") {
      diagnostics.push({
        code: "CONFIG_INVALID_IGNORE_GLOBS",
        message: "sourceIgnoreGlobs must be an array of strings",
        severity: "error",
        location: { file: configPath, line: 1, column: 1 },
      });
      return { resolved: undefined, diagnostics };
    }
  }

  return { resolved: value as ReadonlyArray<string>, diagnostics: [] };
}

function validateTsconfigPath(
  value: unknown,
  configPath: string,
): { resolved: string | null; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  if (value === undefined) {
    return { resolved: null, diagnostics: [] };
  }

  if (typeof value !== "string") {
    diagnostics.push({
      code: "CONFIG_INVALID_TYPE",
      message: "tsconfigPath must be a string",
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { resolved: null, diagnostics };
  }

  if (value === "") {
    diagnostics.push({
      code: "CONFIG_INVALID_PATH",
      message: "tsconfigPath path cannot be empty",
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
        resolversPath: DEFAULT_RESOLVERS_PATH,
        typeDefsPath: DEFAULT_TYPEDEFS_PATH,
        schemaPath: DEFAULT_SCHEMA_PATH,
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

  const resolversPathResult = validateOutputPath(
    output["resolversPath"],
    "output.resolversPath",
    configPath,
  );
  const typeDefsPathResult = validateOutputPath(
    output["typeDefsPath"],
    "output.typeDefsPath",
    configPath,
  );
  const schemaPathResult = validateOutputPath(
    output["schemaPath"],
    "output.schemaPath",
    configPath,
  );

  diagnostics.push(...resolversPathResult.diagnostics);
  diagnostics.push(...typeDefsPathResult.diagnostics);
  diagnostics.push(...schemaPathResult.diagnostics);

  if (diagnostics.length > 0) {
    return { resolved: undefined, diagnostics };
  }

  return {
    resolved: {
      resolversPath: resolversPathResult.resolved,
      typeDefsPath: typeDefsPathResult.resolved,
      schemaPath: schemaPathResult.resolved,
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

  if (typeof scalar["name"] !== "string") {
    diagnostics.push({
      code: "CONFIG_MISSING_PROPERTY",
      message: `scalars[${index}].name is required and must be a string`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
  }

  if (!isRecord(scalar["tsType"])) {
    diagnostics.push({
      code: "CONFIG_MISSING_PROPERTY",
      message: `scalars[${index}].tsType is required and must be an object`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
    return { resolved: undefined, diagnostics };
  }

  const tsType = scalar["tsType"];

  if (typeof tsType["name"] !== "string") {
    diagnostics.push({
      code: "CONFIG_MISSING_PROPERTY",
      message: `scalars[${index}].tsType.name is required and must be a string`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
  }

  if (tsType["from"] !== undefined && typeof tsType["from"] !== "string") {
    diagnostics.push({
      code: "CONFIG_INVALID_TYPE",
      message: `scalars[${index}].tsType.from must be a string`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
  }

  const only = scalar["only"];
  if (only !== undefined && only !== "input" && only !== "output") {
    diagnostics.push({
      code: "CONFIG_INVALID_VALUE",
      message: `scalars[${index}].only must be "input" or "output"`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
  }

  const description = scalar["description"];
  if (description !== undefined && typeof description !== "string") {
    diagnostics.push({
      code: "CONFIG_INVALID_TYPE",
      message: `scalars[${index}].description must be a string`,
      severity: "error",
      location: { file: configPath, line: 1, column: 1 },
    });
  }

  if (diagnostics.length > 0) {
    return { resolved: undefined, diagnostics };
  }

  const graphqlName = scalar["name"] as string;

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
      typeName: tsType["name"] as string,
      importPath: (tsType["from"] as string | undefined) ?? null,
      only: (only as "input" | "output" | undefined) ?? null,
      description: (description as string | undefined) ?? null,
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

  const sourceDirResult = validateSourceDir(config["sourceDir"], configPath);
  diagnostics.push(...sourceDirResult.diagnostics);

  const sourceIgnoreGlobsResult = validateSourceIgnoreGlobs(
    config["sourceIgnoreGlobs"],
    configPath,
  );
  diagnostics.push(...sourceIgnoreGlobsResult.diagnostics);

  const outputResult = validateOutputConfig(config["output"], configPath);
  diagnostics.push(...outputResult.diagnostics);

  const tsconfigPathResult = validateTsconfigPath(
    config["tsconfigPath"],
    configPath,
  );
  diagnostics.push(...tsconfigPathResult.diagnostics);

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
  const seenScalarKeys = new Map<string, number>();
  const seenTypes = new Map<string, { index: number; names: string[] }>();

  for (let i = 0; i < scalarsArray.length; i++) {
    const scalar = scalarsArray[i];
    const result = validateScalarMapping(scalar, i, configPath);
    diagnostics.push(...result.diagnostics);

    if (result.resolved) {
      const { graphqlName, typeName, importPath, only } = result.resolved;

      const scalarKey = `${graphqlName}::${only ?? "both"}`;
      const existingScalarIndex = seenScalarKeys.get(scalarKey);
      if (existingScalarIndex !== undefined) {
        const onlyDesc = only
          ? `with only: "${only}"`
          : "without only constraint";
        diagnostics.push({
          code: "CONFIG_DUPLICATE_MAPPING",
          message: `Duplicate scalar mapping: '${graphqlName}' ${onlyDesc} is defined multiple times`,
          severity: "error",
          location: { file: configPath, line: 1, column: 1 },
        });
      } else {
        seenScalarKeys.set(scalarKey, i);
      }

      const typeKey = `${importPath ?? "global"}::${typeName}`;
      const existingType = seenTypes.get(typeKey);
      if (existingType && !existingType.names.includes(graphqlName)) {
        existingType.names.push(graphqlName);
        diagnostics.push({
          code: "CONFIG_DUPLICATE_TYPE",
          message: `Type '${typeName}' from '${importPath ?? "global"}' is mapped to multiple scalars: ${existingType.names.join(", ")}`,
          severity: "error",
          location: { file: configPath, line: 1, column: 1 },
        });
      } else if (!existingType) {
        seenTypes.set(typeKey, { index: i, names: [graphqlName] });
      }

      if (diagnostics.length === 0) {
        resolvedScalars.push(result.resolved);
      }
    }
  }

  if (
    diagnostics.length > 0 ||
    !sourceDirResult.resolved ||
    !sourceIgnoreGlobsResult.resolved ||
    !outputResult.resolved
  ) {
    return { valid: false, resolvedConfig: undefined, diagnostics };
  }

  return {
    valid: true,
    resolvedConfig: {
      sourceDir: sourceDirResult.resolved,
      sourceIgnoreGlobs: sourceIgnoreGlobsResult.resolved,
      output: outputResult.resolved,
      scalars: resolvedScalars,
      tsconfigPath: tsconfigPathResult.resolved,
    },
    diagnostics: [],
  };
}
