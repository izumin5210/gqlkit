import type { ImportExtension } from "../config/types.js";
import type { Diagnostic } from "../core/index.js";
import { makeConfigDiagnostic } from "./diagnostic.js";
import {
  DEFAULT_IMPORT_EXTENSION,
  DEFAULT_RESOLVERS_PATH,
  DEFAULT_SCHEMA_PATH,
  DEFAULT_SOURCE_DIR,
  DEFAULT_TYPEDEFS_PATH,
  type ResolvedConfig,
  type ResolvedDiscriminatorFieldsMap,
  type ResolvedHooksConfig,
  type ResolvedOutputConfig,
  type ResolvedScalarMapping,
} from "./types.js";

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

/**
 * Shared param shape for validators that only need the raw config value and
 * the config file path (no additional context, e.g. a field name or index).
 */
interface ValidateFieldParams {
  readonly value: unknown;
  readonly configPath: string;
}

interface ValidateOutputPathParams {
  readonly value: unknown;
  readonly fieldName: string;
  readonly configPath: string;
}

function validateOutputPath(params: ValidateOutputPathParams): {
  resolved: string | null;
  diagnostics: Diagnostic[];
} {
  const { value, fieldName, configPath } = params;
  const diagnostics: Diagnostic[] = [];

  if (value === undefined) {
    const defaultPath = getDefaultPathForField(fieldName);
    return { resolved: defaultPath, diagnostics: [] };
  }

  if (value === null) {
    return { resolved: null, diagnostics: [] };
  }

  if (typeof value !== "string") {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_OUTPUT_TYPE",
        message: `${fieldName} must be a string, null, or undefined`,
        configPath,
      }),
    );
    return { resolved: null, diagnostics };
  }

  if (value === "") {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_OUTPUT_PATH",
        message: `${fieldName} path cannot be empty`,
        configPath,
      }),
    );
    return { resolved: null, diagnostics };
  }

  return { resolved: value, diagnostics: [] };
}

function validateSourceDir(params: ValidateFieldParams): {
  resolved: string | undefined;
  diagnostics: Diagnostic[];
} {
  const { value, configPath } = params;
  const diagnostics: Diagnostic[] = [];

  if (value === undefined) {
    return { resolved: DEFAULT_SOURCE_DIR, diagnostics: [] };
  }

  if (typeof value !== "string") {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_TYPE",
        message: "sourceDir must be a string",
        configPath,
      }),
    );
    return { resolved: undefined, diagnostics };
  }

  if (value === "") {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_SOURCE_DIR",
        message: "sourceDir cannot be empty",
        configPath,
      }),
    );
    return { resolved: undefined, diagnostics };
  }

  return { resolved: value, diagnostics: [] };
}

function validateSourceIgnoreGlobs(params: ValidateFieldParams): {
  resolved: ReadonlyArray<string> | undefined;
  diagnostics: Diagnostic[];
} {
  const { value, configPath } = params;
  const diagnostics: Diagnostic[] = [];

  if (value === undefined) {
    return { resolved: [], diagnostics: [] };
  }

  if (!Array.isArray(value)) {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_IGNORE_GLOBS",
        message: "sourceIgnoreGlobs must be an array of strings",
        configPath,
      }),
    );
    return { resolved: undefined, diagnostics };
  }

  for (const item of value) {
    if (typeof item !== "string") {
      diagnostics.push(
        makeConfigDiagnostic({
          code: "CONFIG_INVALID_IGNORE_GLOBS",
          message: "sourceIgnoreGlobs must be an array of strings",
          configPath,
        }),
      );
      return { resolved: undefined, diagnostics };
    }
  }

  return { resolved: value as ReadonlyArray<string>, diagnostics: [] };
}

function validateTsconfigPath(params: ValidateFieldParams): {
  resolved: string | null;
  diagnostics: Diagnostic[];
} {
  const { value, configPath } = params;
  const diagnostics: Diagnostic[] = [];

  if (value === undefined) {
    return { resolved: null, diagnostics: [] };
  }

  if (typeof value !== "string") {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_TYPE",
        message: "tsconfigPath must be a string",
        configPath,
      }),
    );
    return { resolved: null, diagnostics };
  }

  if (value === "") {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_PATH",
        message: "tsconfigPath path cannot be empty",
        configPath,
      }),
    );
    return { resolved: null, diagnostics };
  }

  return { resolved: value, diagnostics: [] };
}

function validateImportExtension(params: ValidateFieldParams): {
  resolved: ImportExtension;
  diagnostics: Diagnostic[];
} {
  const { value, configPath } = params;

  if (value === undefined) {
    return { resolved: DEFAULT_IMPORT_EXTENSION, diagnostics: [] };
  }

  if (value !== "js" && value !== "none" && value !== "ts") {
    return {
      resolved: DEFAULT_IMPORT_EXTENSION,
      diagnostics: [
        makeConfigDiagnostic({
          code: "CONFIG_INVALID_IMPORT_EXTENSION",
          message: 'output.importExtension must be "js", "none", or "ts"',
          configPath,
        }),
      ],
    };
  }

  return { resolved: value, diagnostics: [] };
}

function validatePruning(params: ValidateFieldParams): {
  resolved: boolean;
  diagnostics: Diagnostic[];
} {
  const { value, configPath } = params;

  if (value === undefined) {
    return { resolved: true, diagnostics: [] };
  }

  if (typeof value !== "boolean") {
    return {
      resolved: true,
      diagnostics: [
        makeConfigDiagnostic({
          code: "CONFIG_INVALID_TYPE",
          message: "output.pruning must be a boolean",
          configPath,
        }),
      ],
    };
  }

  return { resolved: value, diagnostics: [] };
}

interface ValidateOutputConfigParams {
  readonly output: unknown;
  readonly configPath: string;
}

function validateOutputConfig(params: ValidateOutputConfigParams): {
  resolved: ResolvedOutputConfig | undefined;
  diagnostics: Diagnostic[];
} {
  const { output, configPath } = params;
  const diagnostics: Diagnostic[] = [];

  if (output === undefined) {
    return {
      resolved: {
        resolversPath: DEFAULT_RESOLVERS_PATH,
        typeDefsPath: DEFAULT_TYPEDEFS_PATH,
        schemaPath: DEFAULT_SCHEMA_PATH,
        importExtension: DEFAULT_IMPORT_EXTENSION,
        pruning: true,
      },
      diagnostics: [],
    };
  }

  if (!isRecord(output)) {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_TYPE",
        message: "output must be an object",
        configPath,
      }),
    );
    return { resolved: undefined, diagnostics };
  }

  const resolversPathResult = validateOutputPath({
    value: output["resolversPath"],
    fieldName: "output.resolversPath",
    configPath,
  });
  const typeDefsPathResult = validateOutputPath({
    value: output["typeDefsPath"],
    fieldName: "output.typeDefsPath",
    configPath,
  });
  const schemaPathResult = validateOutputPath({
    value: output["schemaPath"],
    fieldName: "output.schemaPath",
    configPath,
  });
  const importExtensionResult = validateImportExtension({
    value: output["importExtension"],
    configPath,
  });
  const pruningResult = validatePruning({
    value: output["pruning"],
    configPath,
  });

  diagnostics.push(...resolversPathResult.diagnostics);
  diagnostics.push(...typeDefsPathResult.diagnostics);
  diagnostics.push(...schemaPathResult.diagnostics);
  diagnostics.push(...importExtensionResult.diagnostics);
  diagnostics.push(...pruningResult.diagnostics);

  if (diagnostics.length > 0) {
    return { resolved: undefined, diagnostics };
  }

  return {
    resolved: {
      resolversPath: resolversPathResult.resolved,
      typeDefsPath: typeDefsPathResult.resolved,
      schemaPath: schemaPathResult.resolved,
      importExtension: importExtensionResult.resolved,
      pruning: pruningResult.resolved,
    },
    diagnostics: [],
  };
}

function isNewFormat(
  scalar: Record<string, unknown>,
): scalar is Record<string, unknown> & { name: unknown; tsType: unknown } {
  return "name" in scalar && "tsType" in scalar;
}

/**
 * Renders the new-format (`{ name, tsType }`) equivalent of a config object
 * written in the removed legacy (`{ graphqlName, type }`) shape, using
 * placeholders for any fields the user omitted. Used to make the removal of
 * the legacy format an actionable migration error instead of a bare
 * "invalid" message.
 */
function describeNewFormatEquivalent(scalar: Record<string, unknown>): string {
  const graphqlName = scalar["graphqlName"];
  const name =
    typeof graphqlName === "string" ? JSON.stringify(graphqlName) : "<name>";

  const type = scalar["type"];
  let tsType = "{ name: <name> }";
  if (isRecord(type)) {
    const typeName =
      typeof type["name"] === "string"
        ? JSON.stringify(type["name"])
        : "<name>";
    const from =
      typeof type["from"] === "string"
        ? `, from: ${JSON.stringify(type["from"])}`
        : "";
    tsType = `{ name: ${typeName}${from} }`;
  }

  return `{ name: ${name}, tsType: ${tsType} }`;
}

interface ValidateNewScalarMappingParams {
  readonly scalar: Record<string, unknown>;
  readonly index: number;
  readonly configPath: string;
}

function validateNewScalarMapping(params: ValidateNewScalarMappingParams): {
  resolved: ResolvedScalarMapping | undefined;
  diagnostics: Diagnostic[];
} {
  const { scalar, index, configPath } = params;
  const diagnostics: Diagnostic[] = [];

  if (typeof scalar["name"] !== "string") {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_MISSING_PROPERTY",
        message: `scalars[${index}].name is required and must be a string`,
        configPath,
      }),
    );
  }

  if (!isRecord(scalar["tsType"])) {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_MISSING_PROPERTY",
        message: `scalars[${index}].tsType is required and must be an object`,
        configPath,
      }),
    );
    return { resolved: undefined, diagnostics };
  }

  const tsType = scalar["tsType"];

  if (typeof tsType["name"] !== "string") {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_MISSING_PROPERTY",
        message: `scalars[${index}].tsType.name is required and must be a string`,
        configPath,
      }),
    );
  }

  const only = scalar["only"];
  if (only !== undefined && only !== "input" && only !== "output") {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_ONLY_VALUE",
        message: `scalars[${index}].only must be "input" or "output"`,
        configPath,
      }),
    );
  }

  const description = scalar["description"];
  if (description !== undefined && typeof description !== "string") {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_TYPE",
        message: `scalars[${index}].description must be a string`,
        configPath,
      }),
    );
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
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_BUILTIN_OVERRIDE",
        message: `Cannot override built-in scalar '${graphqlName}'. Built-in scalars: ID, String, Int, Float, Boolean`,
        configPath,
      }),
    );
    return { resolved: undefined, diagnostics };
  }

  const importPath = typeof tsType["from"] === "string" ? tsType["from"] : null;

  return {
    resolved: {
      graphqlName,
      typeName: tsType["name"] as string,
      importPath,
      only: (only as "input" | "output" | undefined) ?? null,
      description: (description as string | undefined) ?? null,
    },
    diagnostics,
  };
}

interface ValidateScalarMappingParams {
  readonly scalar: unknown;
  readonly index: number;
  readonly configPath: string;
}

function validateScalarMapping(params: ValidateScalarMappingParams): {
  resolved: ResolvedScalarMapping | undefined;
  diagnostics: Diagnostic[];
} {
  const { scalar, index, configPath } = params;
  const diagnostics: Diagnostic[] = [];

  if (!isRecord(scalar)) {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_TYPE",
        message: `scalars[${index}] must be an object`,
        configPath,
      }),
    );
    return { resolved: undefined, diagnostics };
  }

  if (isNewFormat(scalar)) {
    return validateNewScalarMapping({ scalar, index, configPath });
  }

  // The legacy `{ graphqlName, type }` scalar mapping format was removed
  // (see Decision D2 in the refactor plan). Detect an attempt to use it and
  // point the user at the new-format equivalent instead of a bare "invalid".
  if ("graphqlName" in scalar || "type" in scalar) {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_LEGACY_SCALAR_FORMAT",
        message: `scalars[${index}] uses the removed legacy scalar mapping format ({ graphqlName, type }). Use the new format instead: ${describeNewFormatEquivalent(scalar)}`,
        configPath,
      }),
    );
    return { resolved: undefined, diagnostics };
  }

  diagnostics.push(
    makeConfigDiagnostic({
      code: "CONFIG_MISSING_PROPERTY",
      message: `scalars[${index}] must have (name, tsType)`,
      configPath,
    }),
  );
  return { resolved: undefined, diagnostics };
}

interface ValidateHooksConfigParams {
  readonly hooks: unknown;
  readonly configPath: string;
}

function validateHooksConfig(params: ValidateHooksConfigParams): {
  resolved: ResolvedHooksConfig | undefined;
  diagnostics: Diagnostic[];
} {
  const { hooks, configPath } = params;
  const diagnostics: Diagnostic[] = [];

  if (hooks === undefined) {
    return {
      resolved: { afterAllFileWrite: [] },
      diagnostics: [],
    };
  }

  if (!isRecord(hooks)) {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_TYPE",
        message: "hooks must be an object",
        configPath,
      }),
    );
    return { resolved: undefined, diagnostics };
  }

  const afterAllFileWrite = hooks["afterAllFileWrite"];

  if (afterAllFileWrite === undefined) {
    return {
      resolved: { afterAllFileWrite: [] },
      diagnostics: [],
    };
  }

  if (typeof afterAllFileWrite === "string") {
    if (afterAllFileWrite === "") {
      diagnostics.push(
        makeConfigDiagnostic({
          code: "CONFIG_INVALID_HOOK_COMMAND",
          message: "hooks.afterAllFileWrite contains empty command",
          configPath,
        }),
      );
      return { resolved: undefined, diagnostics };
    }
    return {
      resolved: { afterAllFileWrite: [afterAllFileWrite] },
      diagnostics: [],
    };
  }

  if (Array.isArray(afterAllFileWrite)) {
    for (const item of afterAllFileWrite) {
      if (typeof item !== "string") {
        diagnostics.push(
          makeConfigDiagnostic({
            code: "CONFIG_INVALID_HOOK_TYPE",
            message:
              "hooks.afterAllFileWrite must be a string or array of strings",
            configPath,
          }),
        );
        return { resolved: undefined, diagnostics };
      }
      if (item === "") {
        diagnostics.push(
          makeConfigDiagnostic({
            code: "CONFIG_INVALID_HOOK_COMMAND",
            message: "hooks.afterAllFileWrite contains empty command",
            configPath,
          }),
        );
        return { resolved: undefined, diagnostics };
      }
    }
    return {
      resolved: { afterAllFileWrite: afterAllFileWrite as string[] },
      diagnostics: [],
    };
  }

  diagnostics.push(
    makeConfigDiagnostic({
      code: "CONFIG_INVALID_HOOK_TYPE",
      message: "hooks.afterAllFileWrite must be a string or array of strings",
      configPath,
    }),
  );
  return { resolved: undefined, diagnostics };
}

function validateDiscriminatorFieldsConfig(params: ValidateFieldParams): {
  resolved: ResolvedDiscriminatorFieldsMap | undefined;
  diagnostics: Diagnostic[];
} {
  const { value, configPath } = params;
  const diagnostics: Diagnostic[] = [];

  if (value === undefined) {
    return { resolved: new Map(), diagnostics: [] };
  }

  if (!isRecord(value)) {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_DISCRIMINATOR_FIELDS",
        message: "discriminatorFields must be an object",
        configPath,
      }),
    );
    return { resolved: undefined, diagnostics };
  }

  const result = new Map<string, ReadonlyArray<string>>();

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      if (entry === "") {
        diagnostics.push(
          makeConfigDiagnostic({
            code: "CONFIG_EMPTY_DISCRIMINATOR_FIELDS",
            message: `discriminatorFields["${key}"] cannot be an empty string`,
            configPath,
          }),
        );
        continue;
      }
      result.set(key, [entry]);
    } else if (Array.isArray(entry)) {
      if (entry.length === 0) {
        diagnostics.push(
          makeConfigDiagnostic({
            code: "CONFIG_EMPTY_DISCRIMINATOR_FIELDS",
            message: `discriminatorFields["${key}"] cannot be an empty array`,
            configPath,
          }),
        );
        continue;
      }
      let hasError = false;
      for (const item of entry) {
        if (typeof item !== "string") {
          diagnostics.push(
            makeConfigDiagnostic({
              code: "CONFIG_INVALID_DISCRIMINATOR_ENTRY",
              message: `discriminatorFields["${key}"] array must contain only strings`,
              configPath,
            }),
          );
          hasError = true;
          break;
        }
        if (item === "") {
          diagnostics.push(
            makeConfigDiagnostic({
              code: "CONFIG_EMPTY_DISCRIMINATOR_FIELDS",
              message: `discriminatorFields["${key}"] array contains an empty string`,
              configPath,
            }),
          );
          hasError = true;
          break;
        }
      }
      if (!hasError) {
        result.set(key, entry as string[]);
      }
    } else {
      diagnostics.push(
        makeConfigDiagnostic({
          code: "CONFIG_INVALID_DISCRIMINATOR_ENTRY",
          message: `discriminatorFields["${key}"] must be a string or array of strings`,
          configPath,
        }),
      );
    }
  }

  if (diagnostics.length > 0) {
    return { resolved: undefined, diagnostics };
  }

  return { resolved: result, diagnostics: [] };
}

export function validateConfig(
  options: ValidateConfigOptions,
): ValidateConfigResult {
  const { config, configPath } = options;
  const diagnostics: Diagnostic[] = [];

  if (!isRecord(config)) {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_TYPE",
        message: "Config must be an object",
        configPath,
      }),
    );
    return { valid: false, resolvedConfig: undefined, diagnostics };
  }

  const sourceDirResult = validateSourceDir({
    value: config["sourceDir"],
    configPath,
  });
  diagnostics.push(...sourceDirResult.diagnostics);

  const sourceIgnoreGlobsResult = validateSourceIgnoreGlobs({
    value: config["sourceIgnoreGlobs"],
    configPath,
  });
  diagnostics.push(...sourceIgnoreGlobsResult.diagnostics);

  const outputResult = validateOutputConfig({
    output: config["output"],
    configPath,
  });
  diagnostics.push(...outputResult.diagnostics);

  const tsconfigPathResult = validateTsconfigPath({
    value: config["tsconfigPath"],
    configPath,
  });
  diagnostics.push(...tsconfigPathResult.diagnostics);

  const hooksResult = validateHooksConfig({
    hooks: config["hooks"],
    configPath,
  });
  diagnostics.push(...hooksResult.diagnostics);

  const discriminatorFieldsResult = validateDiscriminatorFieldsConfig({
    value: config["discriminatorFields"],
    configPath,
  });
  diagnostics.push(...discriminatorFieldsResult.diagnostics);

  if (config["scalars"] !== undefined && !Array.isArray(config["scalars"])) {
    diagnostics.push(
      makeConfigDiagnostic({
        code: "CONFIG_INVALID_TYPE",
        message: "scalars must be an array",
        configPath,
      }),
    );
    return { valid: false, resolvedConfig: undefined, diagnostics };
  }

  const scalarsArray = config["scalars"] ?? [];
  const resolvedScalars: ResolvedScalarMapping[] = [];
  const seenGraphqlNamesWithOnly = new Map<
    string,
    { index: number; only: "input" | "output" | null }
  >();
  const seenTypes = new Map<string, { index: number; names: string[] }>();

  for (let i = 0; i < scalarsArray.length; i++) {
    const scalar = scalarsArray[i];
    const result = validateScalarMapping({ scalar, index: i, configPath });
    diagnostics.push(...result.diagnostics);

    if (result.resolved) {
      const { graphqlName, typeName, importPath, only } = result.resolved;

      const scalarOnlyKey = `${graphqlName}::${only ?? "both"}`;
      const existing = seenGraphqlNamesWithOnly.get(scalarOnlyKey);
      if (existing) {
        diagnostics.push(
          makeConfigDiagnostic({
            code: "CONFIG_DUPLICATE_MAPPING",
            message: `Duplicate scalar mapping: '${graphqlName}' with ${only ? `only: "${only}"` : "no only constraint"} is defined multiple times`,
            configPath,
          }),
        );
      } else {
        seenGraphqlNamesWithOnly.set(scalarOnlyKey, { index: i, only });
      }

      const typeKey = `${importPath}::${typeName}`;
      const existingType = seenTypes.get(typeKey);
      if (existingType && existingType.names[0] !== graphqlName) {
        existingType.names.push(graphqlName);
        diagnostics.push(
          makeConfigDiagnostic({
            code: "CONFIG_DUPLICATE_TYPE",
            message: `Type '${typeName}' from '${importPath}' is mapped to multiple scalars: ${existingType.names.join(", ")}`,
            configPath,
          }),
        );
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
    !outputResult.resolved ||
    !hooksResult.resolved ||
    !discriminatorFieldsResult.resolved
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
      hooks: hooksResult.resolved,
      discriminatorFields: discriminatorFieldsResult.resolved,
    },
    diagnostics: [],
  };
}
