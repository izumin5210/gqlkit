# Requirements Document

## Project Description (Input)
examples ディレクトリをつくり、そこに実際に動作する例をつくりたい。各ユースケースを網羅するようなもっとも薄い例を考え、実装を配置してください

## Introduction

本ドキュメントは、gqlkit の動作例（working-examples）に関する要件を定義する。examples ディレクトリに gqlkit の主要ユースケースを網羅する最小限の実装例を配置し、開発者がすぐに参照・実行できるサンプルを提供する。各例は独立して動作し、特定の機能を明確に示す構成とする。

## Requirements

### Requirement 1: examples ディレクトリ構成

**Objective:** As a 開発者, I want examples ディレクトリに整理された構造でサンプルが配置されていること, so that 目的の機能を素早く見つけて参照できる

#### Acceptance Criteria

1. The examples directory shall リポジトリルート直下に `examples/` ディレクトリとして配置される
2. The examples directory shall 各ユースケースを独立したサブディレクトリとして含む
3. The examples directory shall 各サンプルが個別に実行可能な構成とする
4. When 開発者が examples を参照するとき, the examples directory shall 各サンプルの package.json に必要な依存関係を含める

### Requirement 2: 基本型定義のサンプル（basic-types）

**Objective:** As a gqlkit 初学者, I want 最もシンプルな型定義の例を見たい, so that gqlkit の基本的な使い方を理解できる

#### Acceptance Criteria

1. The basic-types example shall TypeScript interface から GraphQL Object 型への変換を示す
2. The basic-types example shall プリミティブ型（string, number, boolean）のフィールドを含む型定義を示す
3. The basic-types example shall QueryResolver による Query フィールドの定義を示す
4. When `gqlkit gen` を実行した場合, the basic-types example shall `src/gqlkit/generated/` に schema.ts と resolvers.ts を生成する
5. The basic-types example shall 生成されたスキーマを使用して GraphQL サーバーを起動するエントリポイントを含める

### Requirement 3: 型リレーションのサンプル（type-relations）

**Objective:** As a 開発者, I want 型間の参照関係を含む例を見たい, so that ネストした型構造の定義方法を理解できる

#### Acceptance Criteria

1. The type-relations example shall 他の GraphQL 型を参照するフィールドを持つ型定義を示す
2. The type-relations example shall nullable なフィールド（`T | null`）の定義を示す
3. The type-relations example shall リスト型（`T[]`）のフィールド定義を示す
4. The type-relations example shall 少なくとも2つ以上の関連する型を含む
5. When フィールドが別の型を参照している場合, the type-relations example shall その型が GraphQL スキーマで正しく参照されることを示す

### Requirement 4: 引数付きフィールドのサンプル（field-arguments）

**Objective:** As a 開発者, I want GraphQL フィールドへの引数の渡し方を見たい, so that パラメータ付きのクエリを実装できる

#### Acceptance Criteria

1. The field-arguments example shall Query フィールドに引数を持つリゾルバ定義を示す
2. The field-arguments example shall 複数の引数を持つフィールド定義を示す
3. The field-arguments example shall nullable な引数とnon-nullable な引数の両方を示す
4. When args 型がオブジェクト型で定義されている場合, the field-arguments example shall それが GraphQL InputValueDefinition として出力されることを示す

### Requirement 5: 型拡張のサンプル（type-extensions）

**Objective:** As a 開発者, I want 既存の型に計算フィールドを追加する方法を見たい, so that リゾルバベースのフィールド拡張を実装できる

#### Acceptance Criteria

1. The type-extensions example shall type-extractor で定義された型に対するフィールドリゾルバを示す
2. The type-extensions example shall `{TypeName}Resolver` と `{typeName}Resolver` の命名規則を示す
3. The type-extensions example shall parent 引数を受け取るフィールドリゾルバを示す
4. The type-extensions example shall 拡張フィールドが `extend type` として出力されることを示す
5. When 型リゾルバが定義されている場合, the type-extensions example shall その型のリゾルバマップが正しく生成されることを示す

### Requirement 6: Enum 型のサンプル（enums）

**Objective:** As a 開発者, I want TypeScript enum と string literal union の GraphQL 変換を見たい, so that 列挙型を正しく定義できる

#### Acceptance Criteria

1. The enums example shall TypeScript enum から GraphQL Enum への変換を示す
2. The enums example shall string literal union から GraphQL Enum への変換を示す
3. The enums example shall enum を参照するフィールド定義を示す
4. The enums example shall enum メンバー名の SCREAMING_SNAKE_CASE 変換を示す

### Requirement 7: Mutation のサンプル（mutations）

**Objective:** As a 開発者, I want Mutation の定義方法を見たい, so that データ変更操作を実装できる

#### Acceptance Criteria

1. The mutations example shall MutationResolver による Mutation フィールドの定義を示す
2. The mutations example shall 引数を持つ Mutation フィールドを示す
3. The mutations example shall 戻り値型を持つ Mutation フィールドを示す
4. When Mutation が定義されている場合, the mutations example shall resolvers.Mutation が正しく出力されることを示す

### Requirement 8: サンプルの実行可能性

**Objective:** As a 開発者, I want 各サンプルを実際に動作させたい, so that コード生成の結果を確認できる

#### Acceptance Criteria

1. The examples shall 各サンプルディレクトリで `pnpm install` と `pnpm gen` が実行可能であること
2. The examples shall graphql-yoga または類似の軽量 GraphQL サーバーを使用したエントリポイントを含める
3. When サーバーが起動している場合, the examples shall GraphQL Playground またはクエリを実行可能な環境を提供する
4. The examples shall README.md に実行手順を記載する

### Requirement 9: コード最小化原則

**Objective:** As a 学習者, I want 各サンプルが必要最小限のコードで構成されていること, so that 特定の機能に集中して学習できる

#### Acceptance Criteria

1. The examples shall 各サンプルで示す機能に直接関係しないコードを含まない
2. The examples shall 重複するボイラープレートを最小化する
3. The examples shall 各サンプルの目的を明確にするためのコメントを最小限含める
4. If 複数の機能を組み合わせた例が必要な場合, the examples shall それを別のサンプル（例: full-example）として提供する

