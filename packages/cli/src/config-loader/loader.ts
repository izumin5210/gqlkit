import { existsSync } from "node:fs";
import { join } from "node:path";
import { createJiti } from "jiti";
import type { GqlkitConfig } from "../config/types.js";
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

export interface ResolvedConfig {
  readonly scalars: ReadonlyArray<ResolvedScalarMapping>;
}

export interface LoadConfigResult {
  readonly config: ResolvedConfig;
  readonly configPath: string | undefined;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const CONFIG_FILE_NAME = "gqlkit.config.ts";

export async function loadConfig(
  options: LoadConfigOptions,
): Promise<LoadConfigResult> {
  const configPath = join(options.cwd, CONFIG_FILE_NAME);

  if (!existsSync(configPath)) {
    return {
      config: { scalars: [] },
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
        config: { scalars: [] },
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
      config: { scalars: [] },
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
