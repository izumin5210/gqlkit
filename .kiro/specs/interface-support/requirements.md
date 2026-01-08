# Requirements Document

## Introduction

本仕様は、gqlkit における GraphQL interface 型のサポートを追加するための要件を定義する。GraphQL interface は、複数の型が共通のフィールドセットを共有することを宣言するための抽象型であり、ポリモーフィックなクエリを可能にする重要な機能である。

gqlkit の規約駆動アプローチに従い、`DefineInterface<Fields>` ユーティリティ型を導入し、TypeScript の型定義から GraphQL interface を生成する。また、既存の型定義パターンを拡張して `implements` オプションをサポートし、型が interface を実装することを宣言できるようにする。

## Requirements

### Requirement 1: Interface 型の定義

**Objective:** As a gqlkit ユーザー, I want TypeScript で GraphQL interface を定義できるようにしたい, so that 共通フィールドを持つ型群を抽象化できる

#### Acceptance Criteria

1. When `DefineInterface<Fields>` ユーティリティ型を使用して型をエクスポートした場合, the gqlkit CLI shall その型を GraphQL interface として認識する
2. When interface 型定義にフィールドが含まれる場合, the gqlkit CLI shall それらのフィールドを GraphQL interface のフィールドとして生成する
3. The gqlkit CLI shall interface 型のフィールドに対して、通常の Object 型と同じ型マッピングルールを適用する（nullable/non-nullable、リスト型、スカラー型など）
4. When interface 型定義に TSDoc コメントが付与されている場合, the gqlkit CLI shall そのコメントを GraphQL interface の description として生成する

### Requirement 2: Interface の実装宣言

**Objective:** As a gqlkit ユーザー, I want 型が interface を実装することを宣言できるようにしたい, so that GraphQL スキーマで正しい implements 関係を表現できる

#### Acceptance Criteria

1. When 型定義で `implements` オプションに interface 型の配列を指定した場合, the gqlkit CLI shall その型が指定された interface を実装していると認識する
2. When 型が複数の interface を実装する場合, the gqlkit CLI shall すべての interface を GraphQL の implements 句に含める
3. The gqlkit CLI shall interface を実装する型に対して、interface で定義されたすべてのフィールドが存在することを検証する
4. If interface を実装する型に、interface で定義されたフィールドが不足している場合, then the gqlkit CLI shall 不足フィールドを明示したエラーメッセージを表示する
5. If interface を実装する型のフィールドの型が、interface で定義されたフィールドの型と互換性がない場合, then the gqlkit CLI shall 型の不一致を明示したエラーメッセージを表示する

### Requirement 3: Interface 型の抽出

**Objective:** As a gqlkit 開発者, I want type-extractor が interface 定義を正しく抽出できるようにしたい, so that パイプライン全体で interface 情報を利用できる

#### Acceptance Criteria

1. When TypeScript ソースファイルをスキャンする際, the type-extractor shall `DefineInterface` を使用した型定義を検出する
2. When interface 型を抽出する際, the type-extractor shall フィールド名、フィールド型、nullability 情報を抽出する
3. When 型定義に `implements` オプションがある場合, the type-extractor shall 実装する interface 型への参照を抽出する
4. The type-extractor shall interface 型と、interface を実装する型の両方を内部型グラフに登録する

### Requirement 4: GraphQL スキーマ生成

**Objective:** As a gqlkit ユーザー, I want interface 型が正しい GraphQL スキーマとして生成されることを確認したい, so that GraphQL クライアントから interface を利用できる

#### Acceptance Criteria

1. When interface 型が定義されている場合, the schema-generator shall GraphQL の `interface` 型定義を生成する
2. When 型が interface を実装している場合, the schema-generator shall その型の定義に `implements` 句を付与する
3. When 複数の型が同じ interface を実装している場合, the schema-generator shall それぞれの型に正しく `implements` 句を付与する
4. The schema-generator shall interface 型のフィールドと、実装型の対応するフィールドに同一の GraphQL 型を生成する

### Requirement 5: Interface リゾルバーのサポート

**Objective:** As a gqlkit ユーザー, I want interface 型に対してリゾルバーを定義できるようにしたい, so that interface フィールドの解決ロジックを共通化できる

#### Acceptance Criteria

1. When interface 型に `__resolveType` が必要な場合, the gqlkit CLI shall 型解決のためのリゾルバーエントリポイントを生成する
2. Where interface を返すフィールドがある場合, the gqlkit CLI shall そのフィールドのリゾルバー戻り型として interface を実装するすべての型の union を推論する
3. When interface 型に対して `defineField` でフィールドリゾルバーを定義した場合, the gqlkit CLI shall そのリゾルバーを interface のリゾルバーマップに登録する

### Requirement 6: エラーハンドリングと診断

**Objective:** As a gqlkit ユーザー, I want interface 関連のエラーが分かりやすく報告されることを確認したい, so that 問題を迅速に修正できる

#### Acceptance Criteria

1. If 存在しない interface 型を `implements` で参照した場合, then the gqlkit CLI shall 参照先の型名と定義場所を含むエラーメッセージを表示する
2. If `DefineInterface` の型引数が不正な形式である場合, then the gqlkit CLI shall 期待される形式を説明したエラーメッセージを表示する
3. If interface を実装する型のフィールド型が共変でない場合, then the gqlkit CLI shall 型の制約違反を説明したエラーメッセージを表示する
4. If 循環的な interface 継承が検出された場合, then the gqlkit CLI shall 循環の経路を含むエラーメッセージを表示する

### Requirement 7: Runtime パッケージの拡張

**Objective:** As a gqlkit ユーザー, I want `@gqlkit-ts/runtime` パッケージから interface 定義用の型をインポートできるようにしたい, so that 一貫した API を使用できる

#### Acceptance Criteria

1. The @gqlkit-ts/runtime package shall `DefineInterface<Fields>` ユーティリティ型をエクスポートする
2. The @gqlkit-ts/runtime package shall interface 実装を宣言するための型オプションをサポートする
3. When `DefineInterface` を使用する場合, the TypeScript コンパイラ shall フィールド定義の型チェックを行う
