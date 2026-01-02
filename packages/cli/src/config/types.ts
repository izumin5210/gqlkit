/**
 * スキーマ出力オプション。
 * AST と SDL の出力パスを個別に設定できる。
 */
export interface SchemaOutputConfig {
  /**
   * AST (DocumentNode) 形式の出力パス。
   * - 相対パスの場合、プロジェクトルートからの相対パス
   * - null の場合、AST 出力を抑制
   * - undefined の場合、デフォルトパス使用
   * @default "src/gqlkit/generated/schema.ts"
   */
  readonly ast?: string | null;

  /**
   * SDL 形式の出力パス。
   * - 相対パスの場合、プロジェクトルートからの相対パス
   * - null の場合、SDL 出力を抑制
   * - undefined の場合、デフォルトパス使用
   * @default "src/gqlkit/generated/schema.graphql"
   */
  readonly sdl?: string | null;
}

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

  /**
   * スキーマ出力設定。
   * AST と SDL の出力パスを個別に設定できる。
   */
  readonly output?: SchemaOutputConfig;
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
