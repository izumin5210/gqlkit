import type { GqlkitConfig } from "./types.js";

/**
 * Helper function for creating a type-safe config object.
 * Provides IDE autocompletion and compile-time type checking.
 *
 * @example
 * ```typescript
 * // gqlkit.config.ts
 * import { defineConfig } from "@gqlkit-ts/cli";
 *
 * export default defineConfig({
 *   scalars: [
 *     {
 *       name: "DateTime",
 *       tsType: { from: "./src/types/scalars", name: "DateTime" },
 *     },
 *     {
 *       name: "UUID",
 *       tsType: { from: "./src/types/scalars", name: "UUID" },
 *     },
 *   ],
 * });
 * ```
 */
export function defineConfig(config: GqlkitConfig): GqlkitConfig {
  return config;
}
