# Requirements Document

## Project Description (Input)
gqlkit を引数および input field のデフォルト値に対応させたい
directive と同じく `GqlFieldDef` の Meta に `defaultValue` というオプションを追加し、それを input field のデフォルト値として扱うようにする

## Introduction
本機能は、gqlkit において GraphQL の input field および argument に対するデフォルト値を TypeScript 型定義から指定可能にする機能である。既存の directive 指定と同様の Meta オプション方式を採用し、`GqlFieldDef` の `defaultValue` オプションを通じて宣言的にデフォルト値を設定できるようにする。これにより、gqlkit のコンベンション駆動型アプローチを維持しながら、GraphQL スキーマにおける引数およびフィールドのデフォルト値サポートを実現する。

## Requirements

### Requirement 1: GqlFieldDef へのデフォルト値オプション追加

**Objective:** As a gqlkit ユーザー, I want GqlFieldDef の Meta に defaultValue オプションを指定できるようにしたい, so that Input Object や argument のフィールドにデフォルト値を宣言的に設定できる

#### Acceptance Criteria
1. When ユーザーが `GqlFieldDef<T, { defaultValue: V }>` 形式で型を定義した場合, the CLI shall 当該フィールドの defaultValue メタデータとして値 V を抽出する
2. The `@gqlkit-ts/runtime` shall `GqlFieldDef` の Meta 型に `defaultValue` オプショナルプロパティを含める
3. When defaultValue オプションが省略された場合, the CLI shall デフォルト値なしとして扱う
4. The `GqlFieldDef` shall directives と defaultValue の両方を同時に指定可能にする

### Requirement 2: Input Object フィールドへのデフォルト値出力

**Objective:** As a gqlkit ユーザー, I want Input Object 型のフィールドにデフォルト値を設定したい, so that GraphQL スキーマの input field にデフォルト値が反映される

#### Acceptance Criteria
1. When Input Object 型のフィールドに defaultValue が指定されている場合, the Schema Generator shall GraphQL スキーマ AST の当該 InputValueDefinition にデフォルト値を出力する
2. When defaultValue に文字列リテラルが指定されている場合, the Schema Generator shall GraphQL String 値としてデフォルト値を出力する
3. When defaultValue に数値リテラルが指定されている場合, the Schema Generator shall GraphQL Int または Float 値としてデフォルト値を出力する
4. When defaultValue に真偽値リテラルが指定されている場合, the Schema Generator shall GraphQL Boolean 値としてデフォルト値を出力する
5. When defaultValue に null が指定されている場合, the Schema Generator shall GraphQL Null 値としてデフォルト値を出力する
6. When defaultValue に配列リテラルが指定されている場合, the Schema Generator shall GraphQL List 値としてデフォルト値を出力する
7. When defaultValue にオブジェクトリテラルが指定されている場合, the Schema Generator shall GraphQL Object 値としてデフォルト値を出力する
8. When defaultValue に Enum メンバーが指定されている場合, the Schema Generator shall GraphQL Enum 値としてデフォルト値を出力する

### Requirement 3: Query/Mutation 引数へのデフォルト値出力

**Objective:** As a gqlkit ユーザー, I want Query や Mutation の引数にデフォルト値を設定したい, so that GraphQL スキーマの argument にデフォルト値が反映される

#### Acceptance Criteria
1. When Query resolver の引数型のフィールドに defaultValue が指定されている場合, the Schema Generator shall GraphQL Query フィールドの argument にデフォルト値を出力する
2. When Mutation resolver の引数型のフィールドに defaultValue が指定されている場合, the Schema Generator shall GraphQL Mutation フィールドの argument にデフォルト値を出力する
3. When Field resolver の引数型のフィールドに defaultValue が指定されている場合, the Schema Generator shall GraphQL Object 型フィールドの argument にデフォルト値を出力する

### Requirement 4: デフォルト値抽出の静的解析

**Objective:** As a CLI 開発者, I want TypeScript の型情報からデフォルト値を抽出できるようにしたい, so that 実行時評価なしで静的にデフォルト値を取得できる

#### Acceptance Criteria
1. The Type Extractor shall `GqlFieldDef` の Meta から defaultValue プロパティの型情報を抽出する
2. When defaultValue が TypeScript リテラル型として定義されている場合, the Type Extractor shall リテラル値を正確に抽出する
3. When defaultValue が as const アサーションで定義されている場合, the Type Extractor shall リテラル値を正確に抽出する
4. If defaultValue が実行時にのみ決定される式の場合, then the CLI shall エラーを報告して処理を中断する

### Requirement 5: 既存機能との互換性

**Objective:** As a gqlkit ユーザー, I want 既存の directive 機能と併用できるようにしたい, so that 機能追加後も既存のコードが正常に動作する

#### Acceptance Criteria
1. The `GqlFieldDef` shall 既存の directives オプションとの後方互換性を維持する
2. When defaultValue と directives の両方が指定されている場合, the Schema Generator shall 両方のメタデータを正しく GraphQL スキーマに出力する
3. When defaultValue のみが指定されている場合, the `GqlFieldDef` shall directives オプションを省略可能にする

