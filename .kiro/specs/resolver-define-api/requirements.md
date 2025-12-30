# Requirements Document

## Project Description (Input)
resolver 定義を現在のオブジェクトに関数を記述するスタイルから、resolver ごとに関数を定義し、その関数を gqlkit から提供するユーティリティ関数で wrap するスタイルに変更したい。

```ts
// src/gql/resolvers/user.ts
import { defineField, defineMutation, defineQuery, NoArgs } from "@gqlkit-ts/runtime";

export const me = defineQuery<NoArgs, User>(async function (_root, _args, ctx) {
  // ...
})

export type UpdateUserInput = {
  // ...
}

export const updateUser = defineMutation<{ input: UpdateUserInput }, User>(async function (_root, { input }, ctx) {
  // ...
})

export const age = defineField<User, NoArgs, number>(async function (user, _args, ctx) {
  return ...
});
```

## Introduction

本仕様は gqlkit の resolver 定義 API を刷新し、より明示的で型安全なユーティリティ関数ベースのスタイルに移行するための要件を定義する。新しい API は `@gqlkit-ts/runtime` パッケージから提供され、`defineQuery`、`defineMutation`、`defineField` の3つの関数と `NoArgs` 型エイリアスを含む。この変更により、resolver の種類が関数名から明確になり、TypeScript の型推論を最大限に活用できるようになる。

## Requirements

### Requirement 1: ランタイムパッケージの提供

**Objective:** As a gqlkit ユーザー, I want resolver 定義に必要なユーティリティ関数を専用パッケージからインポートできる, so that プロジェクトの依存関係が明確になり、バンドルサイズを最適化できる

#### Acceptance Criteria
1. The `@gqlkit-ts/runtime` package shall export `defineQuery` 関数
2. The `@gqlkit-ts/runtime` package shall export `defineMutation` 関数
3. The `@gqlkit-ts/runtime` package shall export `defineField` 関数
4. The `@gqlkit-ts/runtime` package shall export `NoArgs` 型エイリアス
5. The `@gqlkit-ts/runtime` package shall ランタイム依存を最小限に保ち、graphql-js 以外の外部依存を持たない

### Requirement 2: Query resolver 定義

**Objective:** As a 開発者, I want Query フィールドの resolver を `defineQuery` で定義できる, so that ルートクエリであることが明示的になり、型安全に実装できる

#### Acceptance Criteria
1. When `defineQuery<Args, Return>` が呼び出された場合, the `defineQuery` function shall resolver 関数を受け取り、Query フィールド resolver としてマークされたオブジェクトを返す
2. The `defineQuery` function shall 第一型引数で引数の型を指定できる
3. The `defineQuery` function shall 第二型引数で戻り値の型を指定できる
4. When 引数を取らない Query resolver を定義する場合, the developer shall `NoArgs` 型を第一型引数に指定する
5. The resolver 関数 shall `(root, args, context, info)` のシグネチャを持つ

### Requirement 3: Mutation resolver 定義

**Objective:** As a 開発者, I want Mutation フィールドの resolver を `defineMutation` で定義できる, so that ミューテーションであることが明示的になり、型安全に実装できる

#### Acceptance Criteria
1. When `defineMutation<Args, Return>` が呼び出された場合, the `defineMutation` function shall resolver 関数を受け取り、Mutation フィールド resolver としてマークされたオブジェクトを返す
2. The `defineMutation` function shall 第一型引数で引数の型を指定できる
3. The `defineMutation` function shall 第二型引数で戻り値の型を指定できる
4. When 引数を取らない Mutation resolver を定義する場合, the developer shall `NoArgs` 型を第一型引数に指定する
5. The resolver 関数 shall `(root, args, context, info)` のシグネチャを持つ

### Requirement 4: オブジェクト型フィールド resolver 定義

**Objective:** As a 開発者, I want オブジェクト型のフィールド resolver を `defineField` で定義できる, so that 親オブジェクトの型を明示的に指定でき、型安全にフィールド解決ロジックを実装できる

#### Acceptance Criteria
1. When `defineField<Parent, Args, Return>` が呼び出された場合, the `defineField` function shall resolver 関数を受け取り、フィールド resolver としてマークされたオブジェクトを返す
2. The `defineField` function shall 第一型引数で親オブジェクトの型を指定できる
3. The `defineField` function shall 第二型引数で引数の型を指定できる
4. The `defineField` function shall 第三型引数で戻り値の型を指定できる
5. When 引数を取らないフィールド resolver を定義する場合, the developer shall `NoArgs` 型を第二型引数に指定する
6. The resolver 関数 shall `(parent, args, context, info)` のシグネチャを持つ

### Requirement 5: NoArgs 型エイリアス

**Objective:** As a 開発者, I want 引数を取らない resolver を明示的に宣言できる型がある, so that 空のオブジェクト型 `{}` を毎回記述する必要がなく、意図が明確になる

#### Acceptance Criteria
1. The `NoArgs` type shall 空の引数を表す型エイリアスとして機能する
2. When `NoArgs` が引数型として指定された場合, the resolver function shall args パラメータを使用しないことを型レベルで表現する
3. The `NoArgs` type shall `defineQuery`、`defineMutation`、`defineField` の引数型パラメータで使用できる

### Requirement 6: コード生成との統合

**Objective:** As a gqlkit ユーザー, I want 新しい API で定義した resolver が `gqlkit gen` で正しく処理される, so that GraphQL スキーマと resolver マップが自動生成される

#### Acceptance Criteria
1. When `gqlkit gen` が実行された場合, the gqlkit generator shall `defineQuery` でラップされた export を Query フィールドとして認識する
2. When `gqlkit gen` が実行された場合, the gqlkit generator shall `defineMutation` でラップされた export を Mutation フィールドとして認識する
3. When `gqlkit gen` が実行された場合, the gqlkit generator shall `defineField` でラップされた export を対応する型のフィールド resolver として認識する
4. The gqlkit generator shall export された変数名をフィールド名として使用する
5. When `defineField` で定義された resolver の場合, the gqlkit generator shall 第一型引数（Parent 型）から対象の GraphQL 型を推論する

### Requirement 7: 旧 API との互換性

**Objective:** As a gqlkit メンテナ, I want 旧オブジェクトスタイル API と新 API の混在を禁止する, so that コードベースの一貫性を保ち、保守性を向上させる

#### Acceptance Criteria
1. The gqlkit generator shall 同一プロジェクト内での旧オブジェクトスタイル API と新関数スタイル API の混在を検出する
2. When 旧スタイルと新スタイルの混在が検出された場合, the gqlkit generator shall エラーメッセージを出力し、処理を中断する
3. The error message shall どちらのスタイルを使用すべきかの指針を含む

### Requirement 8: 型推論とエラー検出

**Objective:** As a 開発者, I want TypeScript の型チェックで resolver の実装ミスを早期に検出したい, so that ランタイムエラーを防ぎ、開発効率を向上させる

#### Acceptance Criteria
1. When resolver 関数の戻り値の型が宣言された Return 型と一致しない場合, the TypeScript compiler shall 型エラーを報告する
2. When resolver 関数の args パラメータの使用が宣言された Args 型と一致しない場合, the TypeScript compiler shall 型エラーを報告する
3. When `defineField` の parent パラメータの型が宣言された Parent 型と一致しない場合, the TypeScript compiler shall 型エラーを報告する
4. The define functions shall async 関数と同期関数の両方をサポートする
