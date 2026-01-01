/**
 * gqlkit 設定ファイルの型定義。
 * `gqlkit.config.ts` で使用する。
 */
export interface GqlkitConfig {
  /**
   * カスタムスカラーマッピングの定義。
   * branded type と GraphQL scalar の対応を設定する。
   */
  readonly scalars?: ReadonlyArray<ScalarMappingConfig>;
}

/**
 * 個々のカスタムスカラーマッピング設定。
 */
export interface ScalarMappingConfig {
  /**
   * GraphQL スキーマで使用するスカラー名。
   * 例: "DateTime", "UUID", "URL"
   */
  readonly graphqlName: string;

  /**
   * マッピング対象の TypeScript 型情報。
   */
  readonly type: {
    /**
     * 型のインポートパス。
     * 例: "./src/types/scalars", "@my-lib/scalars"
     */
    readonly from: string;

    /**
     * インポートする型名。
     * 例: "DateTime", "UUID"
     */
    readonly name: string;
  };
}
