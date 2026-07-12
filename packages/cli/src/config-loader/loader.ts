import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { createJiti } from "jiti";
import type { ImportExtension } from "../config/types.js";
import type { Diagnostic } from "../core/index.js";
import { makeConfigDiagnostic } from "./diagnostic.js";
import { validateConfig } from "./validator.js";

export interface LoadConfigOptions {
  readonly cwd: string;
  readonly configPath: string | null;
}

export interface ResolvedScalarMapping {
  readonly graphqlName: string;
  readonly typeName: string;
  readonly importPath: string | null;
  readonly only: "input" | "output" | null;
  readonly description: string | null;
}

/**
 * Resolved output configuration.
 * Undefined values are resolved to defaults.
 */
export interface ResolvedOutputConfig {
  /** Resolver map output path. Null suppresses output */
  readonly resolversPath: string | null;
  /** Schema AST (typeDefs) output path. Null suppresses output */
  readonly typeDefsPath: string | null;
  /** Schema SDL output path. Null suppresses output */
  readonly schemaPath: string | null;
  /** File extension for imports. Default: "js" */
  readonly importExtension: ImportExtension;
  /** Prune types unreachable from root operation types. Default: true */
  readonly pruning: boolean;
}

/**
 * Resolved hook configuration.
 * Commands are normalized to array format.
 */
export interface ResolvedHooksConfig {
  /** Normalized to array (empty if not configured) */
  readonly afterAllFileWrite: ReadonlyArray<string>;
}

/**
 * Normalized discriminator fields mapping.
 * All values are normalized to arrays (single strings are wrapped in arrays).
 */
export type ResolvedDiscriminatorFieldsMap = ReadonlyMap<
  string,
  ReadonlyArray<string>
>;

export interface ResolvedConfig {
  readonly sourceDir: string;
  readonly sourceIgnoreGlobs: ReadonlyArray<string>;
  readonly output: ResolvedOutputConfig;
  readonly scalars: ReadonlyArray<ResolvedScalarMapping>;
  readonly tsconfigPath: string | null;
  readonly hooks: ResolvedHooksConfig;
  readonly discriminatorFields: ResolvedDiscriminatorFieldsMap;
}

export interface LoadConfigResult {
  readonly config: ResolvedConfig;
  readonly configPath: string | undefined;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const CONFIG_FILE_NAME = "gqlkit.config.ts";

export const DEFAULT_SOURCE_DIR = "src/gqlkit/schema";
export const DEFAULT_RESOLVERS_PATH = "src/gqlkit/__generated__/resolvers.ts";
export const DEFAULT_TYPEDEFS_PATH = "src/gqlkit/__generated__/typeDefs.ts";
export const DEFAULT_SCHEMA_PATH = "src/gqlkit/__generated__/schema.graphql";
export const DEFAULT_IMPORT_EXTENSION: ImportExtension = "js";

const DEFAULT_OUTPUT_CONFIG: ResolvedOutputConfig = {
  resolversPath: DEFAULT_RESOLVERS_PATH,
  typeDefsPath: DEFAULT_TYPEDEFS_PATH,
  schemaPath: DEFAULT_SCHEMA_PATH,
  importExtension: DEFAULT_IMPORT_EXTENSION,
  pruning: true,
};

const DEFAULT_HOOKS_CONFIG: ResolvedHooksConfig = {
  afterAllFileWrite: [],
};

const DEFAULT_RESOLVED_CONFIG: ResolvedConfig = {
  sourceDir: DEFAULT_SOURCE_DIR,
  sourceIgnoreGlobs: [],
  output: DEFAULT_OUTPUT_CONFIG,
  scalars: [],
  tsconfigPath: null,
  hooks: DEFAULT_HOOKS_CONFIG,
  discriminatorFields: new Map(),
};

export async function loadConfig(
  options: LoadConfigOptions,
): Promise<LoadConfigResult> {
  const configPath = resolveConfigPath(options);

  if (configPath === null) {
    return {
      config: DEFAULT_RESOLVED_CONFIG,
      configPath: undefined,
      diagnostics: [],
    };
  }

  if (!existsSync(configPath)) {
    if (options.configPath !== null) {
      return {
        config: DEFAULT_RESOLVED_CONFIG,
        configPath,
        diagnostics: [
          makeConfigDiagnostic({
            code: "CONFIG_FILE_NOT_FOUND",
            message: `Config file not found: ${configPath}`,
            configPath,
          }),
        ],
      };
    }
    return {
      config: DEFAULT_RESOLVED_CONFIG,
      configPath: undefined,
      diagnostics: [],
    };
  }

  const jiti = createJiti(options.cwd, {
    interopDefault: true,
  });

  try {
    const loadedModule = await jiti.import(configPath);
    const rawConfig =
      (loadedModule as { default?: unknown }).default ?? loadedModule;

    const validationResult = validateConfig({
      config: rawConfig,
      configPath,
    });

    if (!validationResult.valid || !validationResult.resolvedConfig) {
      return {
        config: DEFAULT_RESOLVED_CONFIG,
        configPath,
        diagnostics: validationResult.diagnostics,
      };
    }

    return {
      config: validationResult.resolvedConfig,
      configPath,
      diagnostics: [],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return {
      config: DEFAULT_RESOLVED_CONFIG,
      configPath,
      diagnostics: [
        makeConfigDiagnostic({
          code: "CONFIG_SYNTAX_ERROR",
          message: `Failed to load config file: ${message}`,
          configPath,
        }),
      ],
    };
  }
}

function resolveConfigPath(options: LoadConfigOptions): string | null {
  if (options.configPath !== null) {
    if (isAbsolute(options.configPath)) {
      return options.configPath;
    }
    return join(options.cwd, options.configPath);
  }
  const defaultPath = join(options.cwd, CONFIG_FILE_NAME);
  if (existsSync(defaultPath)) {
    return defaultPath;
  }
  return null;
}
