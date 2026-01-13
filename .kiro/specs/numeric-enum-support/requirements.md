# Requirements Document

## Project Description (Input)
typescript の numeric enum を graphql enum に変換できるようにしたい。
単純に適用するとランタイムで typescript enum(number) -> graphql enum(string) の変換に失敗するため、gqlkit は number -> string 変換をする resolver も合わせて実装し、createResolvers 関数内でそれら resolver が対応 enum を持つすべての object field について設定されるようなコードを生成するようにしたい。

## Introduction

本機能は、TypeScript の numeric enum（数値列挙型）を GraphQL enum として適切にサポートするためのものである。GraphQL の enum は文字列ベースであるため、TypeScript の numeric enum をそのまま返すとランタイムエラーが発生する。gqlkit はこの問題を解決するため、numeric enum を検出し、自動的に数値から文字列への変換を行うリゾルバを生成する。

## Requirements

### Requirement 1: Numeric Enum の型抽出
**Objective:** 開発者として、TypeScript の numeric enum を GraphQL スキーマの一部として認識させたい。これにより、既存の numeric enum を変更することなく GraphQL API で使用できる。

#### Acceptance Criteria
1. When type-extractor が TypeScript ソースを解析する時, the gqlkit shall numeric enum（値が数値の enum）を検出して抽出する
2. When numeric enum が検出された時, the gqlkit shall 各 enum メンバーの名前と数値を内部データ構造に保持する
3. When enum が string enum と numeric enum の混合である時, the gqlkit shall エラーを報告して処理を中断する
4. The gqlkit shall numeric enum と string enum を区別して管理する

### Requirement 2: GraphQL Enum スキーマ生成
**Objective:** 開発者として、numeric enum から正しい GraphQL enum 定義を生成したい。これにより、GraphQL スキーマが TypeScript の型定義と一貫性を保つ。

#### Acceptance Criteria
1. When numeric enum からスキーマを生成する時, the schema-generator shall enum メンバー名を GraphQL enum 値として出力する
2. When numeric enum に TSDoc コメントがある時, the schema-generator shall コメントを GraphQL description として含める
3. When numeric enum メンバーに `@deprecated` タグがある時, the schema-generator shall GraphQL の `@deprecated` ディレクティブを適用する
4. The schema-generator shall numeric enum と string enum で生成される GraphQL enum スキーマの形式を同一にする

### Requirement 3: Enum 変換リゾルバの生成
**Objective:** 開発者として、numeric enum の数値から GraphQL enum の文字列への変換を自動化したい。これにより、手動で変換ロジックを書く必要がなくなる。

#### Acceptance Criteria
1. When numeric enum が検出された時, the resolver-generator shall 数値から enum メンバー名への変換関数を生成する
2. When 変換関数が数値を受け取った時, the 生成されたリゾルバ shall 対応する enum メンバー名（文字列）を返す
3. If 変換関数が未知の数値を受け取った時, the 生成されたリゾルバ shall 適切なエラーを発生させる
4. The resolver-generator shall 各 numeric enum に対して一つの変換関数を生成する

### Requirement 4: フィールドリゾルバの自動適用
**Objective:** 開発者として、numeric enum を返すすべてのフィールドに変換リゾルバが自動適用されるようにしたい。これにより、enum フィールドごとに個別の設定が不要になる。

#### Acceptance Criteria
1. When Object 型のフィールドが numeric enum を返す時, the gqlkit shall そのフィールドに変換リゾルバを自動的に設定する
2. When フィールドが nullable な numeric enum を返す時, the 生成されたリゾルバ shall null 値を適切に処理する
3. When フィールドが numeric enum の配列を返す時, the 生成されたリゾルバ shall 配列の各要素を変換する
4. When ユーザーがフィールドに明示的なリゾルバを定義している時, the gqlkit shall ユーザー定義のリゾルバを優先し、enum 変換リゾルバを適用しない
5. The gqlkit shall Interface 型のフィールドに対しても numeric enum 変換リゾルバを適用する

### Requirement 5: 生成コードの出力
**Objective:** 開発者として、生成されたリゾルバが既存のコード生成パイプラインと統合されるようにしたい。これにより、一貫した開発体験を維持できる。

#### Acceptance Criteria
1. When `gqlkit gen` を実行した時, the gqlkit shall numeric enum 変換ロジックを含むリゾルバマップを生成する
2. The 生成されたコード shall TypeScript の型安全性を維持する
3. The 生成されたコード shall graphql-tools の `makeExecutableSchema` と互換性を持つ
4. When numeric enum を使用するフィールドがある時, the 生成されたリゾルバファイル shall 必要な変換関数を含める

### Requirement 6: エラーハンドリングと診断
**Objective:** 開発者として、numeric enum に関する問題を早期に発見したい。これにより、ランタイムエラーを防ぎ、デバッグ時間を短縮できる。

#### Acceptance Criteria
1. If numeric enum の値が重複している時, the gqlkit shall 明確なエラーメッセージを出力する
2. If numeric enum メンバー名が GraphQL enum として無効な時, the gqlkit shall 検証エラーを報告する
3. When エラーが発生した時, the gqlkit shall エラー箇所のファイル名と行番号を含める
4. The gqlkit shall 検出された numeric enum の一覧を verbose モードで出力できる
