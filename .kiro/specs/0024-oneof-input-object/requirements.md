# Requirements Document

## Project Description (Input)
oneof input object(@oneof directive) に対応させたい。 input type に union が指定された時に oneof input object として扱う。

## Introduction

本機能は、gqlkit の型抽出・スキーマ生成パイプラインを拡張し、GraphQL の `@oneof` directive をサポートする。TypeScript の union 型を Input Object の構成要素として使用した場合に、GraphQL スキーマ上で `@oneof` directive が付与された Input Object Type として出力する。これにより、ユーザーは TypeScript の型システムを活用して「複数の入力パターンのうち1つだけを指定する」というセマンティクスを表現できる。

## Requirements

### Requirement 1: Union 型の Input Object 認識

**Objective:** As a 開発者, I want Input suffix を持つ union 型を @oneof Input Object として認識させたい, so that TypeScript の union 型で GraphQL の polymorphic な入力を表現できる

#### Acceptance Criteria
1. When `*Input` suffix を持つ TypeScript union 型がエクスポートされた場合, the type-extractor shall その型を @oneof Input Object Type の候補として識別する
2. When union のメンバーが全て object 型（type または interface）である場合, the type-extractor shall その union を有効な @oneof Input Object として認識する
3. When union のメンバーにプリミティブ型や non-object 型が含まれる場合, the type-extractor shall その union を @oneof Input Object として認識しない

### Requirement 2: @oneof Input Object のスキーマ生成

**Objective:** As a 開発者, I want union 型から @oneof directive 付きの GraphQL Input Object を生成したい, so that GraphQL スキーマが正しい @oneof セマンティクスを持つ

#### Acceptance Criteria
1. When @oneof Input Object 候補が検出された場合, the schema-generator shall union の各メンバー型をフィールドとして持つ単一の Input Object Type を生成する
2. The schema-generator shall 生成された Input Object Type に `@oneof` directive を付与する
3. When union メンバー型が `Foo` という名前を持つ場合, the schema-generator shall そのフィールド名を小文字の `foo` として生成する
4. The schema-generator shall @oneof Input Object の各フィールドを nullable として生成する

### Requirement 3: Union メンバー型の展開

**Objective:** As a 開発者, I want union のメンバー型が適切にフィールド定義に展開されてほしい, so that 各入力パターンの構造が正しくスキーマに反映される

#### Acceptance Criteria
1. When union メンバー型がオブジェクト型である場合, the schema-generator shall そのメンバー型をフィールドの型として使用する
2. When union メンバー型自身も `*Input` suffix を持つ場合, the schema-generator shall そのメンバー型を別の Input Object Type として生成し、参照として使用する
3. When union メンバー型が inline object literal 型である場合, the schema-generator shall 適切な Input Object Type を生成して参照する

### Requirement 4: バリデーションとエラー報告

**Objective:** As a 開発者, I want 無効な @oneof 定義に対して明確なエラーを受け取りたい, so that 問題を素早く特定して修正できる

#### Acceptance Criteria
1. If union 型のメンバーが空である場合, the type-extractor shall 「oneof input object には少なくとも1つのメンバーが必要」というエラーを報告する
2. If union 型のメンバー名が重複するフィールド名を生成する場合, the schema-generator shall フィールド名の衝突を報告するエラーを出力する
3. If union メンバー型に解決できない型参照が含まれる場合, the type-extractor shall 参照解決エラーを報告する
4. When エラーが発生した場合, the gen-orchestrator shall エラーの発生箇所（ファイルパス、行番号）を含む診断情報を出力する

### Requirement 5: TSDoc コメントの継承

**Objective:** As a 開発者, I want TSDoc コメントが @oneof Input Object にも適用されてほしい, so that GraphQL スキーマに適切なドキュメントが含まれる

#### Acceptance Criteria
1. When union 型に TSDoc コメントが付与されている場合, the schema-generator shall そのコメントを生成された Input Object Type の description として設定する
2. When union メンバー型に TSDoc コメントが付与されている場合, the schema-generator shall そのコメントを対応するフィールドの description として設定する
3. When TSDoc に `@deprecated` タグが含まれている場合, the schema-generator shall 対応する GraphQL 要素に `@deprecated` directive を付与する
