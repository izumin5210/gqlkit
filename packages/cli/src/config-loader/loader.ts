import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { createJiti } from "jiti";
import type { Diagnostic } from "../core/index.js";
import { makeConfigDiagnostic } from "./diagnostic.js";
import {
  DEFAULT_IMPORT_EXTENSION,
  DEFAULT_RESOLVERS_PATH,
  DEFAULT_SCHEMA_PATH,
  DEFAULT_SOURCE_DIR,
  DEFAULT_TYPEDEFS_PATH,
  type ResolvedConfig,
  type ResolvedHooksConfig,
  type ResolvedOutputConfig,
} from "./types.js";
import { validateConfig } from "./validator.js";

export interface LoadConfigOptions {
  readonly cwd: string;
  readonly configPath: string | null;
}

export interface LoadConfigResult {
  readonly config: ResolvedConfig;
  readonly configPath: string | undefined;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const CONFIG_FILE_NAME = "gqlkit.config.ts";

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
