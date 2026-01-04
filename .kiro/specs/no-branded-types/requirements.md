# Requirements Document

## Project Description (Input)
実装や利用者が触れるエラーの簡単化のため、 branded type の利用をやめたい。

- resolver の型については symbol を使わず `{ [' $gqlkitResolver ']?: { ... } }` のような形でメタデータを保持する
- preset の scalar については厳密な型一致をみない代わりに、 re-export は追跡しない前提で scalar type の import 元の from path ともともとの名前を見て scalar を特定する。 branded ではなく通常の type alias とする

## Introduction

本仕様は、gqlkit における branded type の廃止に関する要件を定義する。現在 `@gqlkit-ts/runtime` が提供する branded scalar type (`IDString`, `IDNumber`, `Int`, `Float`) および resolver の型メタデータ保持に symbol を使用しているが、これらを廃止し、より簡素で扱いやすい実装に置き換える。

主な変更点:
1. Resolver 型のメタデータ保持方法を symbol ベースからオブジェクトプロパティベースに変更
2. Preset scalar の識別方法を branded type の厳密な型一致から import パス + 名前ベースの識別に変更
3. Scalar 型を branded type から通常の type alias に変更

これにより、エラーメッセージの可読性向上、デバッグの容易化、および TypeScript の型推論との親和性向上を実現する。

## Requirements

### Requirement 1: Resolver 型メタデータの保持方法変更

**Objective:** As a gqlkit 開発者, I want resolver の型メタデータを symbol ではなくオブジェクトプロパティで保持できるようにしたい, so that 型エラー時のメッセージが読みやすくなり、デバッグが容易になる

#### Acceptance Criteria
1. The CLI shall resolver 型定義において `{ [' $gqlkitResolver ']?: { ... } }` 形式のプロパティでメタデータを保持する
2. When resolver 型を抽出する際, the CLI shall オブジェクトプロパティ `' $gqlkitResolver '` からメタデータを読み取る
3. The runtime package shall `defineQuery`, `defineMutation`, `defineField` が返す型にオブジェクトプロパティ形式でメタデータを付与する
4. The CLI shall symbol ベースのメタデータ参照を完全に削除する

### Requirement 2: Preset Scalar の識別方法変更

**Objective:** As a gqlkit 利用者, I want preset scalar を import パスと名前で識別できるようにしたい, so that branded type を使わずに GraphQL scalar 型を利用できる

#### Acceptance Criteria
1. When 型抽出時に scalar 型を検出した場合, the CLI shall import 元のパス (`@gqlkit-ts/runtime`) と元の型名 (`IDString`, `IDNumber`, `Int`, `Float`) を基に scalar を特定する
2. The CLI shall re-export された scalar 型は追跡せず、直接 import された型のみを scalar として認識する
3. If scalar 型が re-export 経由で使用されている場合, the CLI shall 通常の型として扱い、対応する GraphQL 型への変換を行わない
4. The CLI shall branded type の型一致チェックを削除する

### Requirement 3: Scalar 型定義の簡素化

**Objective:** As a gqlkit 利用者, I want scalar 型を通常の type alias として使用したい, so that TypeScript の型推論がシンプルになり、エラーメッセージが理解しやすくなる

#### Acceptance Criteria
1. The runtime package shall `IDString` を `type IDString = string` として定義する
2. The runtime package shall `IDNumber` を `type IDNumber = number` として定義する
3. The runtime package shall `Int` を `type Int = number` として定義する
4. The runtime package shall `Float` を `type Float = number` として定義する
5. The runtime package shall 既存の branded type 用の symbol export を削除する

### Requirement 4: 型抽出ロジックの更新

**Objective:** As a gqlkit 開発者, I want 型抽出ロジックが新しい識別方法に対応していることを確認したい, so that コード生成が正しく動作する

#### Acceptance Criteria
1. When TypeScript 型を抽出する際, the CLI shall import 宣言を解析して型の元モジュールパスを取得する
2. When 型が `@gqlkit-ts/runtime` から直接 import されている場合, the CLI shall その型名に対応する GraphQL scalar 型にマッピングする
3. The CLI shall `IDString` を GraphQL の `ID` 型 (String 形式) にマッピングする
4. The CLI shall `IDNumber` を GraphQL の `ID` 型 (Number 形式) にマッピングする
5. The CLI shall `Int` を GraphQL の `Int` 型にマッピングする
6. The CLI shall `Float` を GraphQL の `Float` 型にマッピングする

