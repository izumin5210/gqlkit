# Requirements Document

## Introduction

本ドキュメントは、gqlkit における GraphQL フィールド引数および Input Object 型のサポートに関する要件を定義する。リゾルバ定義の `TArgs` 型パラメータから引数を抽出し、GraphQL スキーマに反映させる機能を実現する。

## Requirements

### Requirement 1: Input Object 型の認識

**Objective:** As a 開発者, I want `Input` で終わる名前のオブジェクト型を GraphQL Input Object として自動認識させたい, so that 明示的なアノテーションなしで Input Object 型を定義できる

#### Acceptance Criteria

1. When `src/gql/types` ディレクトリから型を抽出する際、the Type Extractor shall `Input` で終わる名前のオブジェクト型を Input Object 型として識別する
2. When Input Object 型が識別された場合、the Type Extractor shall その型情報に Input Object であることを示すメタデータを付与する
3. The Type Extractor shall Input Object 型と通常のオブジェクト型を区別して抽出結果に含める
4. If `Input` で終わる型がオブジェクト型でない場合（union、interface 等）、then the Type Extractor shall エラーメッセージを出力する

### Requirement 2: リゾルバ引数型の抽出

**Objective:** As a 開発者, I want リゾルバ定義の `TArgs` 型パラメータから引数情報を抽出したい, so that 型安全な引数定義が可能になる

#### Acceptance Criteria

1. When リゾルバが `defineQuery<Args, Return>` で定義されている場合、the Resolver Extractor shall `Args` 型を引数型として抽出する
2. When リゾルバが `defineMutation<Args, Return>` で定義されている場合、the Resolver Extractor shall `Args` 型を引数型として抽出する
3. When リゾルバが `defineField<Parent, Args, Return>` で定義されている場合、the Resolver Extractor shall `Args` 型を引数型として抽出する
4. When `Args` 型が `NoArgs` の場合、the Resolver Extractor shall 引数なしとして扱う
5. The Resolver Extractor shall 抽出した引数型の各プロパティ名、型、null 許容性を記録する

### Requirement 3: フィールド引数のスキーマ生成

**Objective:** As a 開発者, I want リゾルバの引数型から GraphQL フィールド引数を自動生成したい, so that 手動でスキーマを記述する必要がなくなる

#### Acceptance Criteria

1. When リゾルバに引数型が定義されている場合、the Schema Generator shall 対応する GraphQL フィールドに引数定義を生成する
2. When 引数型のプロパティが optional（`?`）の場合、the Schema Generator shall GraphQL 引数を nullable として生成する
3. When 引数型のプロパティが required の場合、the Schema Generator shall GraphQL 引数を non-null として生成する
4. When 引数型のプロパティが配列型の場合、the Schema Generator shall GraphQL List 型として生成する
5. When 引数型のプロパティが Input Object 型を参照する場合、the Schema Generator shall 対応する GraphQL Input Object 型への参照を生成する

### Requirement 4: Input Object 型定義のスキーマ生成

**Objective:** As a 開発者, I want Input Object 型から GraphQL の `input` 型定義を自動生成したい, so that クライアントが型安全な引数を送信できる

#### Acceptance Criteria

1. When Input Object 型が抽出された場合、the Schema Generator shall GraphQL `input` 型定義を生成する
2. The Schema Generator shall Input Object 型のフィールドを GraphQL input フィールドとして生成する
3. When Input Object 型のフィールドが optional の場合、the Schema Generator shall nullable な input フィールドを生成する
4. When Input Object 型のフィールドが他の Input Object 型を参照する場合、the Schema Generator shall ネストした Input Object 型参照を生成する
5. If Input Object 型のフィールドが通常のオブジェクト型（Output 型）を参照する場合、then the Schema Generator shall エラーを報告する

### Requirement 5: スカラー型および Enum 型の引数サポート

**Objective:** As a 開発者, I want 基本的なスカラー型および Enum 型を引数として使用したい, so that シンプルな引数を定義できる

#### Acceptance Criteria

1. The Schema Generator shall `string` 型を GraphQL `String` 型として引数に使用可能とする
2. The Schema Generator shall `number` 型を GraphQL `Int` 型として引数に使用可能とする
3. The Schema Generator shall `boolean` 型を GraphQL `Boolean` 型として引数に使用可能とする
4. When 引数型のプロパティが Enum 型を参照する場合、the Schema Generator shall 対応する GraphQL Enum 型への参照を生成する
5. The Schema Generator shall Input Object 型のフィールドでも Enum 型を使用可能とする

### Requirement 6: エラーハンドリングと検証

**Objective:** As a 開発者, I want 不正な引数定義に対して明確なエラーメッセージを受け取りたい, so that 問題を迅速に修正できる

#### Acceptance Criteria

1. If 引数型のプロパティが未知の型を参照する場合、then the Schema Generator shall 型が見つからないエラーを報告する
2. If 引数型が循環参照を含む場合、then the Schema Generator shall 循環参照エラーを報告する
3. If Input Object 型が Output 型のフィールドを含む場合、then the Schema Generator shall Input Object に Output 型は使用できないエラーを報告する
4. When エラーが発生した場合、the Schema Generator shall エラー箇所のファイルパスと行番号を含める
5. The Schema Generator shall 複数のエラーを収集し、まとめて報告する

