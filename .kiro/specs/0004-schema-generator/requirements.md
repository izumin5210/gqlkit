# Requirements Document

## Introduction

このドキュメントは、schema-generator 機能の要件を定義します。schema-generator は type-extractor と resolver-extractor の出力を統合し、GraphQL スキーマ AST（DocumentNode）と makeExecutableSchema に渡せる resolver map を含む TypeScript コードを生成するコンポーネントです。

## Requirements

### Requirement 1: スキーマ AST 生成

**Objective:** As a 開発者, I want type-extractor の型定義を GraphQL スキーマ AST に変換したい, so that graphql-tools と互換性のあるスキーマ定義を生成できる

#### Acceptance Criteria

1. When type-extractor から Object 型情報を受け取った場合, the Schema Generator shall 対応する GraphQL ObjectTypeDefinition ノードを生成する
2. When type-extractor から Union 型情報を受け取った場合, the Schema Generator shall 対応する GraphQL UnionTypeDefinition ノードを生成する
3. When フィールドが nullable として定義されている場合, the Schema Generator shall GraphQL の nullable 型（NonNullType でラップしない）として出力する
4. When フィールドが non-nullable として定義されている場合, the Schema Generator shall GraphQL の NonNullType でラップして出力する
5. When フィールドがリスト型として定義されている場合, the Schema Generator shall GraphQL の ListType でラップして出力する
6. The Schema Generator shall graphql-js の DocumentNode 形式で AST を出力する

### Requirement 2: Query/Mutation 型生成

**Objective:** As a 開発者, I want resolver-extractor から抽出された Query/Mutation フィールドを統合したい, so that GraphQL のルート型を正しく生成できる

#### Acceptance Criteria

1. When resolver-extractor から queryFields を受け取った場合, the Schema Generator shall Query 型の ObjectTypeDefinition を生成する
2. When resolver-extractor から mutationFields を受け取った場合, the Schema Generator shall Mutation 型の ObjectTypeDefinition を生成する
3. When フィールドに引数定義がある場合, the Schema Generator shall 対応する InputValueDefinition を生成する
4. If queryFields が空の場合, the Schema Generator shall Query 型を生成しない
5. If mutationFields が空の場合, the Schema Generator shall Mutation 型を生成しない

### Requirement 3: 型拡張の統合

**Objective:** As a 開発者, I want type-extractor の型定義と resolver-extractor の型拡張を分離出力したい, so that resolver で定義された計算フィールドが `extend type` として明確に区別される

#### Acceptance Criteria

1. When resolver-extractor から typeExtensions を受け取った場合, the Schema Generator shall GraphQL の `extend type` 構文で出力する
2. If typeExtension の targetTypeName に対応する型が type-extractor の結果に存在しない場合, the Schema Generator shall エラー診断を生成する
3. ~~When ベース型とリゾルバの両方に同名フィールドが存在する場合, the Schema Generator shall リゾルバ側のフィールド定義を優先する~~ → 削除: `extend type` 分離出力によりフィールドマージ不要

### Requirement 4: Resolver Map 生成

**Objective:** As a 開発者, I want makeExecutableSchema に渡せる resolver map オブジェクトを生成したい, so that GraphQL サーバーで即座に使用できる

#### Acceptance Criteria

1. The Schema Generator shall Query リゾルバを resolvers.Query オブジェクトとして出力する
2. The Schema Generator shall Mutation リゾルバを resolvers.Mutation オブジェクトとして出力する
3. When typeExtensions が存在する場合, the Schema Generator shall 対応する型名をキーとしてリゾルバフィールドを出力する
4. The Schema Generator shall 各リゾルバ実装への参照を維持したまま resolver map を構築する
5. The Schema Generator shall graphql-tools の makeExecutableSchema と互換性のある形式で出力する

### Requirement 5: TypeScript コード生成

**Objective:** As a 開発者, I want 生成されたスキーマとリゾルバを TypeScript コードとして出力したい, so that プロジェクトでインポートして使用できる

#### Acceptance Criteria

1. The Schema Generator shall typeDefs を DocumentNode 型の export として生成する
2. The Schema Generator shall resolvers オブジェクトを適切な型付きの export として生成する
3. The Schema Generator shall 生成ファイルを src/gqlkit/generated/ ディレクトリに出力する
4. The Schema Generator shall ESM 互換の import/export 構文を使用する
5. The Schema Generator shall リゾルバソースファイルからの相対 import パスを正しく解決する

### Requirement 6: 診断とエラーハンドリング

**Objective:** As a 開発者, I want 生成時の問題を明確なエラーメッセージで把握したい, so that 迅速に問題を修正できる

#### Acceptance Criteria

1. When 型参照が解決できない場合, the Schema Generator shall 参照元の場所情報を含むエラー診断を生成する
2. When 入力に既存のエラー診断が含まれている場合, the Schema Generator shall それらを伝播する
3. If いずれかの入力に severity: "error" の診断が含まれている場合, the Schema Generator shall コード生成をスキップして診断のみを返す
4. The Schema Generator shall Diagnostic 型（code, message, severity, location）に準拠した診断を生成する

### Requirement 7: 決定論的出力

**Objective:** As a 開発者, I want 同一の入力から常に同一の出力を得たい, so that ビルドの再現性を確保できる

#### Acceptance Criteria

1. The Schema Generator shall 型定義を名前順でソートして出力する
2. The Schema Generator shall 各型内のフィールドを名前順でソートして出力する
3. The Schema Generator shall resolver map のキーを一貫した順序で出力する
4. When 同一の入力が与えられた場合, the Schema Generator shall バイト単位で同一の出力を生成する
