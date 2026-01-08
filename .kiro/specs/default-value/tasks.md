# Implementation Plan

## Task Overview

GraphQL input field および argument に対するデフォルト値サポートを実装する。既存の directive 処理パターンを拡張し、`DirectiveArgumentValue` 型を共通の値表現として再利用する。

## Implementation Tasks

- [x] 1. Runtime 層: GqlFieldDef の Meta 型を拡張してデフォルト値オプションを追加
- [x] 1.1 (P) GqlFieldMetaShape に defaultValue オプションを追加
  - Meta 型の `directives` をオプショナルに変更し、`defaultValue` オプションを追加する
  - `defaultValue` は `unknown` 型として定義し、TypeScript のリテラル型推論を活用する
  - `GqlFieldDef` の型定義を更新して directives と defaultValue の両方を同時に指定可能にする
  - 既存の directives のみを指定するコードとの互換性は考慮不要（breaking change 許容）
  - _Requirements: 1.2, 1.4_

- [x] 2. CLI/Shared 層: デフォルト値の検出・抽出機能を実装
- [x] 2.1 (P) DirectiveArgumentValue に null 値サポートを追加
  - `DirectiveArgumentValue` 型に `{ kind: "null"; value: null }` バリアントを追加する
  - `resolveArgumentValue` 関数で TypeScript の `null` 型フラグを検出してnull 値を返却する
  - 既存の directive 引数処理にも null サポートが適用される
  - _Requirements: 2.5_

- [x] 2.2 defaultValue 検出関数を実装
  - `$gqlkitFieldMeta` から `defaultValue` プロパティを検出する関数を追加する
  - TypeScript リテラル型から値を抽出するために既存の `resolveArgumentValue` を再利用する
  - 非リテラル型（実行時評価が必要な式）の場合はエラーを返却する
  - 関数は `defaultValue` と `errors` を含む結果オブジェクトを返却する
  - _Requirements: 1.1, 1.3, 4.1, 4.2, 4.3, 4.4_

- [x] 3. TypeExtractor 層: フィールド抽出時に defaultValue を検出して内部表現に追加
- [x] 3.1 FieldDefinition にデフォルト値を統合
  - `FieldDefinition` 型に `defaultValue` プロパティを追加する
  - フィールド抽出処理で `detectDefaultValueMetadata` を呼び出してデフォルト値を検出する
  - 検出エラーは diagnostics に追加して報告する
  - Input Object 型のフィールドでデフォルト値が正しく抽出されることを確認する
  - _Requirements: 1.1, 4.1, 4.2, 4.3, 4.4_

- [x] 4. ResolverExtractor 層: 引数抽出時に defaultValue を検出して内部表現に追加
- [x] 4.1 (P) ArgumentDefinition にデフォルト値を統合
  - `ArgumentDefinition` 型に `defaultValue` プロパティを追加する
  - 引数抽出処理で `detectDefaultValueMetadata` を呼び出してデフォルト値を検出する
  - Query/Mutation/Field resolver の引数型でデフォルト値が正しく抽出されることを確認する
  - 検出エラーは diagnostics に追加して報告する
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. SchemaGenerator 層: GraphQL AST にデフォルト値を出力
- [x] 5.1 InputValueDefinition へのデフォルト値出力を実装
  - `DirectiveArgumentValue` から `ConstValueNode` への変換関数を追加する（既存の directive 引数変換ロジックを拡張）
  - null 値の場合は `NullValue` ノードを生成する
  - 数値の場合は整数と浮動小数点を判定して `IntValue` または `FloatValue` を生成する
  - `GraphQLInputValue` と `BaseField` 型に `defaultValue` プロパティを追加する
  - `buildInputValueDefinitionNode` と `buildInputFieldDefinitionNode` で defaultValue を AST に出力する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3_

- [x] 5.2 directives と defaultValue の同時出力を確認
  - フィールドに directives と defaultValue の両方が指定されている場合、両方が正しく GraphQL スキーマに出力されることを確認する
  - _Requirements: 5.2_

- [x] 6. Golden File テスト: 統合テストケースを追加
- [x] 6.1 基本的なデフォルト値のテストケースを追加
  - `default-value-basic/` テストケースを作成する
  - 文字列、数値（整数・浮動小数点）、真偽値、null のデフォルト値を含む Input Object と resolver 引数を定義する
  - 生成される GraphQL スキーマにデフォルト値が正しく出力されることを確認する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3_

- [x] 6.2 (P) 複雑なデフォルト値のテストケースを追加
  - `default-value-complex/` テストケースを作成する
  - 配列、オブジェクト、Enum のデフォルト値を含む定義を追加する
  - ネストした配列・オブジェクトのデフォルト値が正しく出力されることを確認する
  - _Requirements: 2.6, 2.7, 2.8_

- [x] 6.3 (P) directives との併用テストケースを追加
  - `default-value-with-directives/` テストケースを作成する
  - defaultValue と directives の両方を指定したフィールドを定義する
  - 両方のメタデータが正しく GraphQL スキーマに出力されることを確認する
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 6.4 エラーケースのテストケースを追加
  - `default-value-errors/` テストケースを作成する
  - 非リテラル型（変数参照、関数呼び出しなど）のデフォルト値を定義する
  - 適切なエラーメッセージが diagnostics に報告されることを確認する
  - _Requirements: 4.4_
