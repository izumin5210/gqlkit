# Implementation Plan

## Tasks

- [x] 1. @gqlkit-ts/runtime パッケージ基盤構築
- [x] 1.1 pnpm workspace にランタイムパッケージを追加
  - packages/runtime ディレクトリを作成し、package.json を設定
  - TypeScript 設定を追加（strict mode、ESM 出力）
  - graphql を peer dependency として設定
  - パッケージのエントリポイントとエクスポート設定
  - ビルド設定とパッケージ公開設定
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.2 NoArgs 型と Context 型の基盤定義
  - NoArgs 型エイリアスを空の引数を表す型として定義
  - Gqlkit 名前空間をグローバルに宣言し、Context インターフェースを空で定義
  - ユーザーがモジュール拡張で Context を拡張できる仕組みを構築
  - GqlkitContext 条件型を定義し、未定義時は unknown にフォールバック
  - GraphQLResolveInfo 型の再エクスポート設定
  - _Requirements: 1.4, 5.1, 5.2, 5.3_

- [x] 2. ランタイム関数の実装
- [x] 2.1 (P) defineQuery 関数の実装
  - QueryResolverFn 型を定義（root: undefined, args, context, info の4パラメータ）
  - 第一型引数で引数の型、第二型引数で戻り値の型を指定可能にする
  - 引数をそのまま返す identity 関数として実装
  - Promise 戻り値と同期戻り値の両方をサポート
  - NoArgs を第一型引数として使用可能にする
  - 型の不一致時に TypeScript コンパイラがエラーを報告することを確認
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.4_

- [x] 2.2 (P) defineMutation 関数の実装
  - MutationResolverFn 型を定義（root: undefined, args, context, info の4パラメータ）
  - 第一型引数で引数の型、第二型引数で戻り値の型を指定可能にする
  - 引数をそのまま返す identity 関数として実装
  - Promise 戻り値と同期戻り値の両方をサポート
  - NoArgs を第一型引数として使用可能にする
  - 型の不一致時に TypeScript コンパイラがエラーを報告することを確認
  - _Requirements: 1.2, 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.2, 8.4_

- [x] 2.3 (P) defineField 関数の実装
  - FieldResolverFn 型を定義（parent, args, context, info の4パラメータ）
  - 第一型引数で親オブジェクトの型、第二型引数で引数の型、第三型引数で戻り値の型を指定可能にする
  - 引数をそのまま返す identity 関数として実装
  - Promise 戻り値と同期戻り値の両方をサポート
  - NoArgs を第二型引数として使用可能にする
  - 型の不一致時に TypeScript コンパイラがエラーを報告することを確認
  - _Requirements: 1.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.1, 8.2, 8.3, 8.4_

- [x] 3. コード生成機能の拡張
- [x] 3.1 DefineApiExtractor の実装
  - TypeScript AST から export const + defineQuery/defineMutation/defineField 呼び出しパターンを検出
  - エクスポート名を GraphQL フィールド名として抽出
  - 各 define* 関数の型パラメータ（Args, Return, Parent）を解析
  - 抽出した情報を DefineApiResolverInfo 構造体に格納
  - 複雑な式パターン（条件分岐など）は INVALID_DEFINE_CALL 診断を出力
  - リゾルバファイルからエクスポートされた型定義を InputType として検出
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 3.2 ParentTypeResolver の実装
  - defineField の TParent 型パラメータから型名を抽出
  - 型エイリアスのチェーンを追跡して元の型名を解決
  - 解決した型名が src/gql/types に定義されているか検証
  - type-extractor の結果と照合して検証
  - 未定義の型に対しては MISSING_PARENT_TYPE 診断を出力
  - 解決結果を ParentTypeResolution 構造体で返却
  - _Requirements: 6.5_

- [x] 3.3 旧 API 検出と混在エラー処理
  - 旧オブジェクトスタイル API（QueryResolver 型 + queryResolver 値のペア）の検出ロジックを実装
  - 同一プロジェクト内での旧スタイルと新スタイルの混在を検出
  - 混在検出時に LEGACY_API_DETECTED エラーを出力し処理を中断
  - エラーメッセージに新関数スタイル API への移行指針を含める
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 4. 既存システムとの統合
- [x] 4.1 resolver-extractor への DefineApiExtractor 統合
  - extractResolversFromProgram に新 API 抽出ロジックを追加
  - DefineApiExtractor の結果を既存の抽出結果と統合
  - 旧 API が検出された場合は混在チェックを実行
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 4.2 schema-generator への統合
  - DefineApiResolverInfo を AnalyzedResolver 形式に変換
  - 新 API から抽出したリゾルバをスキーマ生成フローに統合
  - 入力型を GraphQL スキーマの Input type として生成
  - ParentTypeResolver の結果を使用してフィールドを適切な型に配置
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 5. テストとバリデーション
- [x] 5.1 (P) ランタイム関数の型推論テスト
  - defineQuery の Args あり/なし、Promise 戻り値の型推論を検証
  - defineMutation の入力型引数と戻り値の型推論を検証
  - defineField の Parent, Args, Return の型推論を検証
  - NoArgs を使用した場合の型推論を検証
  - Context 型のモジュール拡張が適用されることを検証
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 8.1, 8.2, 8.3, 8.4_

- [x] 5.2 (P) コード生成機能の統合テスト
  - defineQuery/defineMutation/defineField を使用したファイルからの抽出テスト
  - 親タイプ解決のエンドツーエンドテスト
  - 旧スタイルと新スタイルの混在検出テスト
  - エラーメッセージの内容検証
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3_

- [x] 5.3 examples プロジェクトでの E2E テスト
  - 新 API を使用した example プロジェクトの作成または更新
  - gqlkit gen 実行による typeDefs と resolvers の生成検証
  - 生成物が graphql-tools で正しく動作することを確認
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1, 6.2, 6.3, 6.4, 6.5_
