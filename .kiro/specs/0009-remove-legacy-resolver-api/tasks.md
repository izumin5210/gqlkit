# Implementation Plan

## Tasks

- [x] 1. レガシー Resolver API 実装の削除
- [x] 1.1 レガシーリゾルバ抽出ロジックを削除する
  - `*Resolver` 型/値ペアの検出・抽出処理を削除
  - シグネチャ解析機能を削除
  - フィールド変換機能を削除
  - 注: extract-resolvers から参照されているため、先に参照を削除してから本体を削除すること
  - _Requirements: 1.2_

- [x] 1.2 リゾルバ抽出エントリポイントからレガシー API 呼び出しを削除する
  - レガシー抽出関数の呼び出しを削除
  - レガシー API へのフォールバックパスを削除
  - Define API のみを使用したリゾルバ抽出処理に統一
  - 1.1 で削除するファイルへのインポートを削除
  - _Requirements: 1.1_

- [x] 1.3 (P) Mixed API バリデーションロジックを削除する
  - 両 API の混在検証処理を削除
  - API スタイル判定機能を削除
  - 整合性チェック呼び出しを削除
  - 注: 1.2 と並行可能（別ファイル）
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 1.4 レガシー関連の診断コードを削除する
  - `MISSING_RESOLVER_VALUE` 診断コードを削除
  - `MISSING_RESOLVER_TYPE` 診断コードを削除
  - 関連するエラーメッセージ定義を削除
  - _Requirements: 1.3_

- [x] 1.5 公開エクスポートからレガシー型定義を削除する
  - レガシー専用型（`ResolverPair`、`ExtractedResolvers`、`ResolverCategory` 等）のエクスポートを削除
  - `signature-analyzer.ts` からの型（`AnalyzedField`、`AnalyzedResolver`、`AnalyzedResolvers`、`ArgumentDefinition`）のエクスポートを削除
  - 削除したファイルからのインポート文を削除
  - Define API 関連の型のみをエクスポートする状態に整理
  - _Requirements: 1.4, 6.1, 6.3_

- [x] 2. サンプルプロジェクトの Define API への移行
  - コーディング規約: アロー関数ではなく `function` を使用、未使用引数は省略可
- [x] 2.1 (P) basic-types サンプルを Define API で再実装する
  - `QueryResolver` 型/値ペアを削除
  - `defineQuery` を使用して Query リゾルバを定義
  - `@gqlkit-ts/runtime` からの適切なインポートを追加
  - _Requirements: 3.1, 3.7_

- [x] 2.2 (P) mutations サンプルを Define API で再実装する
  - `QueryResolver` および `MutationResolver` 型/値ペアを削除
  - `defineQuery` を使用して Query リゾルバを定義
  - `defineMutation` を使用して Mutation リゾルバを定義
  - 引数の型定義を適切に移行
  - _Requirements: 3.2, 3.7_

- [x] 2.3 (P) type-relations サンプルを Define API で再実装する
  - user.ts および post.ts の `QueryResolver` 型/値ペアを削除
  - 関連する型のリゾルバを `defineQuery` または `defineField` で定義
  - 型間の参照関係を維持
  - _Requirements: 3.3, 3.7_

- [x] 2.4 (P) type-extensions サンプルを Define API で再実装する
  - `QueryResolver` 型/値ペアを削除
  - `UserResolver` 型/値ペアを削除
  - `defineQuery` を使用して Query リゾルバを定義
  - `defineField` を使用して型拡張フィールドリゾルバを定義
  - _Requirements: 3.4, 3.7_

- [x] 2.5 (P) enums サンプルを Define API で再実装する
  - `QueryResolver` 型/値ペアを削除
  - `defineQuery` または `defineField` を使用してリゾルバを定義
  - 列挙型の返却を適切に処理
  - _Requirements: 3.5, 3.7_

- [x] 2.6 (P) field-arguments サンプルを Define API で再実装する
  - `QueryResolver` 型/値ペアを削除
  - Define API を使用して引数付きフィールドリゾルバを定義
  - 引数の型パラメータを適切に指定
  - _Requirements: 3.6, 3.7_

- [x] 3. テストコードの更新
- [x] 3.1 (P) レガシー API 抽出テストを削除する
  - レガシーリゾルバ抽出のテストファイルを削除
  - シグネチャ解析のテストファイルを削除
  - フィールド変換のテストファイルを削除（存在する場合）
  - _Requirements: 5.1_

- [x] 3.2 (P) Mixed API バリデーションテストを削除する
  - Mixed API バリデータのテストファイルを削除
  - _Requirements: 5.2_

- [x] 3.3 統合テストからレガシー API 関連テストケースを削除する
  - extract-resolvers 統合テストからレガシー API テストケースを削除
  - Define API のみを使用するテストケースを維持
  - 3.1, 3.2 の完了後に実行（依存ファイルの削除が完了していること）
  - _Requirements: 5.3_

- [x] 4. ドキュメントの更新
- [x] 4.1 (P) CLAUDE.md からレガシー API 記述を削除し Define API 説明を追加する
  - Resolver 命名規約セクション（`*Resolver` 型 + `*resolver` 値ペア）を削除
  - Resolver 関数シグネチャセクションを削除
  - `defineQuery`、`defineMutation`、`defineField` の使用方法を追加
  - `NoArgs` 型と `GqlkitContext` の説明を追加
  - コード例は `function` を使用、未使用引数は省略
  - _Requirements: 4.1, 4.2_

- [x] 4.2 (P) steering ドキュメントからレガシー API 記述を削除する
  - structure.md の Naming Conventions セクションからレガシー規約を削除
  - product.md からレガシー API への言及を削除
  - Define API に関する正確な説明を維持または追加
  - _Requirements: 4.3, 4.4_

- [x] 5. 全体検証とランタイムパッケージ確認
- [x] 5.1 runtime パッケージの公開 API を確認する
  - `@gqlkit-ts/runtime` が `defineQuery`、`defineMutation`、`defineField`、`NoArgs`、`GqlkitContext` のみを公開していることを確認
  - 不要なエクスポートがあれば削除
  - _Requirements: 6.2_

- [x] 5.2 全サンプルプロジェクトで gqlkit gen の動作を検証する
  - 各サンプルプロジェクトで `gqlkit gen` を実行
  - スキーマとリゾルバマップが正常に生成されることを確認
  - ビルドエラーがないことを確認
  - _Requirements: 3.8_

- [x] 5.3 全テストスイートの実行と最終確認を行う
  - `pnpm check` でコード品質を確認
  - 全テストがパスすることを確認
  - コードベースにレガシー API への参照が残っていないことを確認
  - _Requirements: 5.3_
