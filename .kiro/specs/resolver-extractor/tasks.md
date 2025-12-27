# Implementation Plan

## Task 1: ファイルスキャン機能の実装

- [x] 1.1 ディレクトリスキャンと基本収集
  - 指定ディレクトリ以下の `.ts` ファイルを再帰的に収集する機能を実装
  - ディレクトリが存在しない場合に `DIRECTORY_NOT_FOUND` 診断エラーを返す
  - 空ディレクトリの場合は空の結果を返す（エラーとしない）
  - type-extractor の `scanDirectory` との共有化を検討
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.2 (P) ファイル除外ロジック
  - `.d.ts` ファイルをスキャン対象から除外
  - テストファイル（`.test.ts`, `.spec.ts`）をスキャン対象から除外
  - `node_modules` ディレクトリを除外
  - _Requirements: 1.4, 1.5_

## Task 2: Resolver 型・値の抽出

- [x] 2.1 Resolver 型の認識
  - `*Resolver` サフィックスを持つ export 型を resolver 型として認識
  - `QueryResolver` を Query ルートリゾルバとして認識
  - `MutationResolver` を Mutation ルートリゾルバとして認識
  - `{TypeName}Resolver`（Query/Mutation 以外）を型フィールドリゾルバとして認識
  - interface と type alias の両方をサポート
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2.2 Resolver 値の認識とペアリング
  - `{TypeName}Resolver` 型に対応する `{typeName}Resolver` 値（camelCase）を探索
  - 同一ファイル内で型と値が export されている場合にペアとして登録
  - ペアリング失敗時の診断エラー生成（`MISSING_RESOLVER_VALUE`, `MISSING_RESOLVER_TYPE`, `NAMING_CONVENTION_MISMATCH`）
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

## Task 3: シグネチャ解析機能の実装

- [x] 3.1 Query/Mutation シグネチャ解析
  - 関数型プロパティを識別
  - `() => ReturnType` シグネチャを引数なしルートフィールドとして認識
  - `(args: ArgsType) => ReturnType` シグネチャの第1引数を GraphQL フィールド引数として認識
  - 不正シグネチャに対する `INVALID_RESOLVER_SIGNATURE` 診断エラー生成
  - _Requirements: 4.1, 4.2, 4.3, 4.9_

- [x] 3.2 (P) 型リゾルバシグネチャ解析
  - `(parent: ParentType) => ReturnType` シグネチャを parent 引数付きフィールドとして認識
  - `(parent: ParentType, args: ArgsType) => ReturnType` シグネチャの第2引数を GraphQL 引数として認識
  - parent 引数型と resolver 名から推論される型の一致検証
  - 不一致時の `PARENT_TYPE_MISMATCH` 診断エラー生成
  - _Requirements: 4.4, 4.5, 4.9_

- [x] 3.3 引数・戻り値型の解析
  - args 型のプロパティを GraphQL InputValue 定義に変換
  - 戻り値型から nullable/non-null および list/non-list を推論
  - `Promise<T>` 型を内部型 `T` として解釈
  - _Requirements: 4.6, 4.7, 4.8_

## Task 4: GraphQL フィールド定義変換

- [x] 4.1 スカラー型変換ロジック
  - TypeScript `string` を GraphQL `String` に変換
  - TypeScript `number` を GraphQL `Int` に変換（デフォルト）
  - TypeScript `boolean` を GraphQL `Boolean` に変換
  - `T | null` ユニオンを nullable フィールドとして解釈
  - 配列型（`T[]`, `Array<T>`）を GraphQL リスト型に変換
  - type-extractor で定義された型を GraphQL 型参照として使用
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 4.2 (P) Query/Mutation フィールド定義生成
  - QueryResolver から Query 型フィールド定義リストを生成
  - MutationResolver から Mutation 型フィールド定義リストを生成
  - 戻り値型を GraphQL 型に変換
  - フィールド名をそのまま GraphQL フィールド名として使用
  - args 引数存在時に GraphQL 引数リストを含める
  - サポート外の型に対する `UNSUPPORTED_RETURN_TYPE`, `UNSUPPORTED_ARG_TYPE` 診断エラー生成
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 4.3 (P) 型拡張フィールド定義生成
  - `{TypeName}Resolver` から対応 GraphQL 型へのフィールド拡張を生成
  - フィールドリゾルバの戻り値型を GraphQL 型に変換
  - parent 引数型と対象型が一致する場合にフィールドを型拡張として登録
  - args 引数存在時に GraphQL 引数リストを含める
  - 対象型が type-extractor 結果に存在しない場合の `UNKNOWN_TARGET_TYPE` 警告生成
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

## Task 5: 結果収集と出力

- [x] 5. 結果の構造化と診断情報集約
  - Query フィールド定義、Mutation フィールド定義、型拡張を分離した構造で返却
  - 各フィールド定義にソースファイル位置情報を含める
  - すべての診断情報（errors/warnings）を収集して分類
  - エラー存在時も部分的な結果とエラーの両方を返却
  - type-extractor と同様の出力形式で統合を容易化
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

## Task 6: 統合とエントリポイント

- [x] 6.1 extractResolvers パイプライン統合
  - Scanner → Extractor → Analyzer → Converter → Collector のパイプラインを統合
  - `extractResolvers(options)` エントリポイント関数を実装
  - 各ステージ間のデータフローを接続
  - _Requirements: 1.1, 7.5_

- [x] 6.2 統合テストと E2E 検証
  - 完全な resolver ディレクトリからの抽出フローをテスト
  - Query/Mutation + 型リゾルバの混合ケースを検証
  - エラーケースでの部分結果返却を確認
  - 複数ファイルにまたがる resolver 定義の動作確認
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1_
