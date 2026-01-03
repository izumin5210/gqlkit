import { existsSync } from "node:fs";
import { join } from "node:path";
import { createJiti } from "jiti";
import type { Diagnostic } from "../type-extractor/types/index.js";
import { validateConfig } from "./validator.js";

export interface LoadConfigOptions {
  readonly cwd: string;
}

export interface ResolvedScalarMapping {
  readonly graphqlName: string;
  readonly typeName: string;
  readonly importPath: string;
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
}

export interface ResolvedConfig {
  readonly sourceDir: string;
  readonly sourceIgnoreGlobs: ReadonlyArray<string>;
  readonly output: ResolvedOutputConfig;
  readonly scalars: ReadonlyArray<ResolvedScalarMapping>;
  readonly tsconfigPath: string | null;
}

export interface LoadConfigResult {
  readonly config: ResolvedConfig;
  readonly configPath: string | undefined;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const CONFIG_FILE_NAME = "gqlkit.config.ts";

export const DEFAULT_SOURCE_DIR = "src/gqlkit";
export const DEFAULT_RESOLVERS_PATH = "src/gqlkit/__generated__/resolvers.ts";
export const DEFAULT_TYPEDEFS_PATH = "src/gqlkit/__generated__/typeDefs.ts";
export const DEFAULT_SCHEMA_PATH = "src/gqlkit/__generated__/schema.graphql";

const DEFAULT_OUTPUT_CONFIG: ResolvedOutputConfig = {
  resolversPath: DEFAULT_RESOLVERS_PATH,
  typeDefsPath: DEFAULT_TYPEDEFS_PATH,
  schemaPath: DEFAULT_SCHEMA_PATH,
};

const DEFAULT_RESOLVED_CONFIG: ResolvedConfig = {
  sourceDir: DEFAULT_SOURCE_DIR,
  sourceIgnoreGlobs: [],
  output: DEFAULT_OUTPUT_CONFIG,
  scalars: [],
  tsconfigPath: null,
};

export async function loadConfig(
  options: LoadConfigOptions,
): Promise<LoadConfigResult> {
  const configPath = join(options.cwd, CONFIG_FILE_NAME);

  if (!existsSync(configPath)) {
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
        {
          code: "CONFIG_SYNTAX_ERROR",
          message: `Failed to load config file: ${message}`,
          severity: "error",
          location: {
            file: configPath,
            line: 1,
            column: 1,
          },
        },
      ],
    };
  }
}
