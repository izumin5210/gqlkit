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
 * 解決済みの出力設定。
 * undefined はデフォルト値に解決された状態。
 */
export interface ResolvedOutputConfig {
  /** AST 出力パス。null は出力抑制 */
  readonly ast: string | null;
  /** SDL 出力パス。null は出力抑制 */
  readonly sdl: string | null;
}

export interface ResolvedConfig {
  readonly scalars: ReadonlyArray<ResolvedScalarMapping>;
  readonly output: ResolvedOutputConfig;
}

export interface LoadConfigResult {
  readonly config: ResolvedConfig;
  readonly configPath: string | undefined;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

const CONFIG_FILE_NAME = "gqlkit.config.ts";

export const DEFAULT_AST_OUTPUT_PATH = "src/gqlkit/generated/schema.ts";
export const DEFAULT_SDL_OUTPUT_PATH = "src/gqlkit/generated/schema.graphql";

const DEFAULT_OUTPUT_CONFIG: ResolvedOutputConfig = {
  ast: DEFAULT_AST_OUTPUT_PATH,
  sdl: DEFAULT_SDL_OUTPUT_PATH,
};

const DEFAULT_RESOLVED_CONFIG: ResolvedConfig = {
  scalars: [],
  output: DEFAULT_OUTPUT_CONFIG,
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
