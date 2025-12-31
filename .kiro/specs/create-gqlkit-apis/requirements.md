# Requirements Document

## Project Description (Input)
現在の @packages/runtime/src/index.ts の Context の設計では1つの typescript project で複数の graphql schema に対応できない。 なのでそれを回避するために project ごとに defineQuery, defineMutation, defineField の各 define api を生成させるような設計に変えたい

```ts
export type Context = {
  // ...
}

// 利用者はここで生成された define 関数を利用して resolver を定義する
export const {
  defineQuery,
  defineMutation,
  defineField,
} = createGqlkitApis<Context>();
```

## Introduction

本機能は `@gqlkit-ts/runtime` パッケージに `createGqlkitApis` ファクトリ関数を追加し、1つの TypeScript プロジェクト内で複数の GraphQL スキーマをそれぞれ異なる Context 型で運用できるようにする。現在のグローバル namespace を使用した設計では、プロジェクト全体で1つの Context 型しか定義できないという制約があり、管理者用 API と公開 API など複数スキーマを持つプロジェクトでの利用が困難である。

## Requirements

### Requirement 1: createGqlkitApis ファクトリ関数

**Objective:** As a gqlkit ユーザー, I want Context 型をジェネリクスで指定してリゾルバ定義関数を生成する, so that 1つのプロジェクトで複数の GraphQL スキーマを異なる Context で運用できる

#### Acceptance Criteria
1. When `createGqlkitApis<TContext>()` を呼び出した場合, the runtime shall `defineQuery`, `defineMutation`, `defineField` 関数を含むオブジェクトを返す
2. The runtime shall ジェネリクス型パラメータ `TContext` を通じて Context 型を指定可能にする
3. When Context 型が指定されていない場合, the runtime shall `unknown` 型をデフォルトの Context 型として使用する

### Requirement 2: 生成された defineQuery 関数の型安全性

**Objective:** As a gqlkit ユーザー, I want defineQuery で定義するリゾルバの context 引数が指定した Context 型になる, so that Query リゾルバで型安全にコンテキストにアクセスできる

#### Acceptance Criteria
1. When `createGqlkitApis<TContext>()` で生成された `defineQuery` を使用した場合, the runtime shall リゾルバ関数の `context` 引数を `TContext` 型として型推論する
2. The runtime shall `defineQuery<TArgs, TResult>(resolver)` の形式で引数型と戻り値型を指定可能にする
3. When リゾルバ関数が渡された場合, the runtime shall その関数をそのまま返す（identity 関数として動作する）

### Requirement 3: 生成された defineMutation 関数の型安全性

**Objective:** As a gqlkit ユーザー, I want defineMutation で定義するリゾルバの context 引数が指定した Context 型になる, so that Mutation リゾルバで型安全にコンテキストにアクセスできる

#### Acceptance Criteria
1. When `createGqlkitApis<TContext>()` で生成された `defineMutation` を使用した場合, the runtime shall リゾルバ関数の `context` 引数を `TContext` 型として型推論する
2. The runtime shall `defineMutation<TArgs, TResult>(resolver)` の形式で引数型と戻り値型を指定可能にする
3. When リゾルバ関数が渡された場合, the runtime shall その関数をそのまま返す（identity 関数として動作する）

### Requirement 4: 生成された defineField 関数の型安全性

**Objective:** As a gqlkit ユーザー, I want defineField で定義するリゾルバの context 引数が指定した Context 型になる, so that フィールドリゾルバで型安全にコンテキストにアクセスできる

#### Acceptance Criteria
1. When `createGqlkitApis<TContext>()` で生成された `defineField` を使用した場合, the runtime shall リゾルバ関数の `context` 引数を `TContext` 型として型推論する
2. The runtime shall `defineField<TParent, TArgs, TResult>(resolver)` の形式で親型、引数型、戻り値型を指定可能にする
3. When リゾルバ関数が渡された場合, the runtime shall その関数をそのまま返す（identity 関数として動作する）

### Requirement 5: 複数スキーマのサポート

**Objective:** As a gqlkit ユーザー, I want 同一プロジェクト内で異なる Context を持つ複数の API セットを作成する, so that 管理者 API と公開 API など異なるコンテキストを必要とするスキーマを1つのプロジェクトで管理できる

#### Acceptance Criteria
1. When `createGqlkitApis` を異なる型パラメータで複数回呼び出した場合, the runtime shall それぞれ独立した define 関数セットを返す
2. The runtime shall 各 define 関数セットがそれぞれの Context 型に対して正しく型付けされることを保証する
3. When 異なる Context 型の define 関数を混在して使用した場合, the runtime shall TypeScript の型チェックで不整合を検出可能にする

### Requirement 6: 既存型定義のエクスポート維持

**Objective:** As a gqlkit ユーザー, I want 既存の型定義（NoArgs など）を引き続き利用できる, so that リゾルバ定義時に必要な補助型を使用できる

#### Acceptance Criteria
1. The runtime shall `NoArgs` 型を引き続きエクスポートする
2. The runtime shall `QueryResolverFn`, `MutationResolverFn`, `FieldResolverFn` 型をジェネリクス化してエクスポートする
3. When ユーザーがリゾルバ型を明示的に指定したい場合, the runtime shall Context 型を含む完全な型シグネチャを指定可能にする

### Requirement 7: CLI によるリゾルバ検出（Branded Type）

**Objective:** As a gqlkit ユーザー, I want `createGqlkitApis` で生成した define 関数で定義したリゾルバが `gqlkit gen` で検出される, so that ファクトリパターンを使用しても従来通りリゾルバマップが生成される

#### Acceptance Criteria
1. The runtime shall define 関数の戻り値型に型レベルのマーカー（Branded Type）を付与する
2. The runtime shall マーカーにリゾルバの種類（query/mutation/field）を含める
3. When CLI がリゾルバをスキャンした場合, the CLI shall Branded Type のマーカーを検出してリゾルバとして認識する
4. The runtime shall マーカーはランタイムに影響を与えない（型レベルのみ）
5. When 既存のグローバル define 関数を使用した場合, the CLI shall 従来通りインポート元による検出を行う（後方互換性）
