# Requirements Document

## Project Description (Input)
`gqlkit gen` で resolver map が生成されなくなっている。元通り makeExecutableSchema に対応している resolverMap の生成に対応させて ultrathink

## Introduction

本仕様は、`gqlkit gen` コマンドにおける resolver map 生成機能を修復するための要件を定義する。Define API（`defineQuery`、`defineMutation`、`defineField`）で定義されたリゾルバが、graphql-tools の `makeExecutableSchema` と互換性のある resolver map として正しく生成されるようにする。

現状では、リゾルバ抽出・スキーマ生成のインフラストラクチャは存在するが、Define API で定義されたリゾルバが生成される `resolvers.ts` に含まれていない。本仕様では、この問題を解決し、すべてのリゾルバが正しく resolver map に含まれるようにする。

## Requirements

### Requirement 1: Query リゾルバの resolver map 生成

**Objective:** As a gqlkit ユーザー, I want `defineQuery` で定義した Query リゾルバが resolver map に含まれる状態, so that `makeExecutableSchema` でスキーマを構築し、クエリを実行できる

#### Acceptance Criteria
1. When `gqlkit gen` を実行した場合, the gqlkit CLI shall `defineQuery` でエクスポートされた各リゾルバに対応するフィールドを `resolvers.Query` オブジェクトに含める
2. When resolver map を生成する場合, the gqlkit CLI shall エクスポートされた変数名（例: `me`、`users`）をフィールド名として使用する
3. When resolver map を生成する場合, the gqlkit CLI shall 各リゾルバのソースファイルから正しい相対パスで import 文を生成する
4. The 生成された resolver map shall 以下の形式で Query リゾルバを含む: `Query: { fieldName: importedResolver, ... }`

### Requirement 2: Mutation リゾルバの resolver map 生成

**Objective:** As a gqlkit ユーザー, I want `defineMutation` で定義した Mutation リゾルバが resolver map に含まれる状態, so that `makeExecutableSchema` でスキーマを構築し、ミューテーションを実行できる

#### Acceptance Criteria
1. When `gqlkit gen` を実行した場合, the gqlkit CLI shall `defineMutation` でエクスポートされた各リゾルバに対応するフィールドを `resolvers.Mutation` オブジェクトに含める
2. When resolver map を生成する場合, the gqlkit CLI shall エクスポートされた変数名をフィールド名として使用する
3. When resolver map を生成する場合, the gqlkit CLI shall 各リゾルバのソースファイルから正しい相対パスで import 文を生成する
4. The 生成された resolver map shall 以下の形式で Mutation リゾルバを含む: `Mutation: { fieldName: importedResolver, ... }`

### Requirement 3: フィールドリゾルバの resolver map 生成

**Objective:** As a gqlkit ユーザー, I want `defineField` で定義したフィールドリゾルバが resolver map に含まれる状態, so that 型のカスタムフィールド解決ロジックを使用できる

#### Acceptance Criteria
1. When `gqlkit gen` を実行した場合, the gqlkit CLI shall `defineField` でエクスポートされた各リゾルバを対応する親型のオブジェクトに含める
2. When フィールドリゾルバを分類する場合, the gqlkit CLI shall `defineField` の第一型引数（Parent 型）から対象の GraphQL 型を決定する
3. When resolver map を生成する場合, the gqlkit CLI shall エクスポートされた変数名をフィールド名として使用する
4. The 生成された resolver map shall 以下の形式でフィールドリゾルバを含む: `TypeName: { fieldName: importedResolver, ... }`

### Requirement 4: import 文の正確な生成

**Objective:** As a gqlkit ユーザー, I want 生成されたファイルが正しい import パスを持つ状態, so that TypeScript コンパイラがエラーなくファイルを処理できる

#### Acceptance Criteria
1. When import 文を生成する場合, the gqlkit CLI shall 出力ディレクトリからリゾルバソースファイルへの正しい相対パスを計算する
2. When import 文を生成する場合, the gqlkit CLI shall `.ts` 拡張子を `.js` に変換する（ESM 互換性のため）
3. When 相対パスが `./` で始まらない場合, the gqlkit CLI shall パスの先頭に `./` を追加する
4. When 同一ファイルから複数のリゾルバをインポートする場合, the gqlkit CLI shall 単一の import 文にまとめる

### Requirement 5: makeExecutableSchema 互換性

**Objective:** As a gqlkit ユーザー, I want 生成された resolver map が graphql-tools の `makeExecutableSchema` で直接使用できる状態, so that 追加の変換なしでスキーマを構築できる

#### Acceptance Criteria
1. The 生成された resolver map shall `makeExecutableSchema({ typeDefs, resolvers })` の `resolvers` パラメータとして直接使用できる
2. The 生成された resolver map shall 各リゾルバ関数が `(parent, args, context, info)` シグネチャを持つ関数として参照される
3. When 生成されたスキーマで GraphQL クエリを実行した場合, the GraphQL 実行エンジン shall 対応するリゾルバ関数を正しく呼び出す

### Requirement 6: 決定論的な出力

**Objective:** As a gqlkit 開発者, I want 同じ入力に対して常に同じ出力が生成される状態, so that ビルドの再現性が保証される

#### Acceptance Criteria
1. When `gqlkit gen` を複数回実行した場合, the gqlkit CLI shall 同じ入力に対して同一の `resolvers.ts` を生成する
2. When resolver map を生成する場合, the gqlkit CLI shall 型名をアルファベット順にソートする
3. When resolver map を生成する場合, the gqlkit CLI shall 各型内のフィールド名をアルファベット順にソートする
4. When import 文を生成する場合, the gqlkit CLI shall インポートパスをアルファベット順にソートする

### Requirement 7: サンプルプロジェクトでの動作確認

**Objective:** As a gqlkit 開発者, I want すべてのサンプルプロジェクトで resolver map が正しく生成される状態, so that 実装の正確性を検証できる

#### Acceptance Criteria
1. When `examples/define-api` で `gqlkit gen` を実行した場合, the gqlkit CLI shall Query、Mutation、およびフィールドリゾルバを含む resolver map を生成する
2. When `examples/basic-types` で `gqlkit gen` を実行した場合, the gqlkit CLI shall Query リゾルバを含む resolver map を生成する
3. When `examples/mutations` で `gqlkit gen` を実行した場合, the gqlkit CLI shall Mutation リゾルバを含む resolver map を生成する
4. When `examples/type-relations` で `gqlkit gen` を実行した場合, the gqlkit CLI shall フィールドリゾルバを含む resolver map を生成する
5. When `examples/type-extensions` で `gqlkit gen` を実行した場合, the gqlkit CLI shall 型拡張フィールドリゾルバを含む resolver map を生成する
6. When 各サンプルプロジェクトの生成されたスキーマを使用した場合, the GraphQL サーバー shall クエリに対して期待通りの結果を返す
