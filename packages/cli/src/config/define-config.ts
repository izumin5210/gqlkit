import type { GqlkitConfig } from "./types.js";

/**
 * 型安全な設定オブジェクトを作成するヘルパー関数。
 * IDE での型補完とコンパイル時の型チェックを提供する。
 *
 * @example
 * ```typescript
 * // gqlkit.config.ts
 * import { defineConfig } from "@gqlkit-ts/cli";
 *
 * export default defineConfig({
 *   scalars: [
 *     {
 *       graphqlName: "DateTime",
 *       type: { from: "./src/types/scalars", name: "DateTime" },
 *     },
 *     {
 *       graphqlName: "UUID",
 *       type: { from: "./src/types/scalars", name: "UUID" },
 *     },
 *   ],
 * });
 * ```
 */
export function defineConfig(config: GqlkitConfig): GqlkitConfig {
  return config;
}
