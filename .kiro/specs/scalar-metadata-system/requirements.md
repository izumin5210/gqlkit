# Requirements Document

## Project Description (Input)
## Scalar 型システムのリファクタリング

### 概要

gqlkit の scalar 型の扱いを整理し、metadata ベースの型システムに移行する。現在の import-path + 型名ベースの検出方式から、TypeScript の型情報に埋め込まれた metadata を読み取る方式に変更する。

### 背景

現在の実装では scalar 型の検出に以下の課題がある：
- custom scalar の定義に `gqlkit.config.ts` での設定が必要
- input/output で異なる型を使いたいユースケース（例: DateTime）に対応できない
- 型の意図が型定義自体から読み取れない

### 詳細仕様

#### 1. 基本マッピング

TypeScript のプリミティブ型は以下の GraphQL 型に自動マッピングされる：

| TypeScript | GraphQL |
|------------|---------|
| `string` | `String` |
| `boolean` | `Boolean` |
| `number` | `Float` |

#### 2. Scalar Metadata 構造

scalar 型は以下の metadata 構造を持つ intersection type として表現する：

```typescript
Base & { " $gqlkitScalar"?: { name: Name; only?: "input" | "output" } }
```

- `name`: GraphQL scalar 名
- `only`: input 専用 / output 専用を区別（省略時は両方で使用可能）
- metadata プロパティは optional（`?`）にすることで、underlying type との互換性を保つ

#### 3. runtime 提供型

`@gqlkit-ts/runtime` から以下の型を提供する：

```typescript
// Built-in scalar 用の型
export type Int = number & { " $gqlkitScalar"?: { name: "Int" } }
export type Float = number & { " $gqlkitScalar"?: { name: "Float" } }
export type IDString = string & { " $gqlkitScalar"?: { name: "ID" } }
export type IDNumber = number & { " $gqlkitScalar"?: { name: "ID" } }

// Custom scalar 定義用の utility type
export type DefineScalar<
  Name extends string,
  Base,
  Only extends "input" | "output" | undefined = undefined
> = Base & {
  " $gqlkitScalar"?: {
    name: Name
    only: Only
  }
}
```

#### 4. Custom Scalar の定義

ユーザーは sourceDir 内で scalar metadata を持つ型を export することで custom scalar を定義できる：

```typescript
// src/gql/types/scalars.ts
import { DefineScalar } from "@gqlkit-ts/runtime"

// input/output 両方で使用可能
export type DateTime = DefineScalar<"DateTime", Date>

// output 専用（resolver が返せる型）
export type DateTimeOutput = DefineScalar<"DateTime", Date | string, "output">

// input 専用（resolver が受け取る型）
export type DateTimeInput = DefineScalar<"DateTime", Date, "input">
```

sourceDir 内で export された scalar metadata 付き型は、自動的に GraphQL schema の scalar 定義として含まれる。

#### 4.1. 設定ファイルによる Custom Scalar マッピング

`DefineScalar` を使用できないケース（ORM が生成した型など）に対応するため、設定ファイルでも TypeScript 型を custom scalar にマッピングできる：

```typescript
// gqlkit.config.ts
export default {
  scalars: [
    // グローバルな型（Date など）をマッピング
    { name: "DateTime", tsType: { name: "Date" } },
    // 特定のモジュールからの型をマッピング
    { name: "DateTime", tsType: { name: "DateTimeString", from: "./src/types" } },
    // only 指定も可能
    { name: "DateTime", tsType: { name: "Date" }, only: "input" },
    { name: "DateTime", tsType: { name: "DateTimeOutput", from: "./src/types" }, only: "output" },
    // description の指定
    { name: "DateTime", tsType: { name: "Date" }, description: "ISO 8601 形式の日時" },
  ]
}
```

設定ファイルでのマッピング仕様：
- `name`: GraphQL scalar 名
- `tsType.name`: TypeScript 型名
- `tsType.from`: 型のインポート元（省略時はグローバルな型として扱う）
- `only`: `"input"` | `"output"`（省略時は両方で使用可能）
- `description`: scalar の説明（省略可）

**優先順位と結合:**
- `DefineScalar` での定義と設定ファイルでの定義は両方とも有効
- 同一 scalar に対する複数の型マッピングとして扱われる
- description は設定ファイルの `description` フィールドと TSDoc コメントの両方から収集し、結合される

設定ファイルで定義した scalar も自動的に GraphQL schema の scalar 定義として含まれる。

#### 5. Scalar 実装の注入

生成される `resolvers.ts` は object ではなく関数として export され、custom scalar の実装を引数で要求する：

```typescript
import { GraphQLScalarType } from "graphql"

// custom scalar がある場合
export function createResolvers({ scalars }: {
  scalars: {
    DateTime: GraphQLScalarType<DateTimeInput, DateTimeOutput>
  }
}): Resolvers {
  return {
    DateTime: scalars.DateTime,
    Query: { ... },
    Mutation: { ... },
  }
}

// custom scalar がない場合
export function createResolvers(): Resolvers {
  return {
    Query: { ... },
    Mutation: { ... },
  }
}
```

`GraphQLScalarType` の型パラメータ：
- 第1型パラメータ（TInternal）: input 用の型（parseValue/parseLiteral の返り値）
- 第2型パラメータ（TExternal）: output 用の型（serialize の入力値）

#### 6. 型パラメータの収集ロジック

同一 scalar に対して複数の TypeScript 型が定義されている場合、用途ごとに収集する。

**input 型の収集（1つのみ許容）:**
- `only: "input"` の型
- `only` が省略された型

GraphQL scalar の parseValue/parseLiteral は特定の1つの型しか返せないため、input 用の型が複数検出された場合はエラーとする。

**output 型の収集（複数許容、union 構築）:**
- `only: "output"` の型
- `only` が省略された型

serialize は複数の型を受け取れるため、output 用の型は複数定義でき、union として扱われる。

**必須条件:**
- 各 custom scalar には **output 用の型が1つ以上** 必要
- 各 custom scalar には **input 用の型がちょうど1つ** 必要

例（有効なパターン）:
```typescript
// パターン1: only なし 1つのみ（input/output 両方で使用）
export type DateTime = DefineScalar<"DateTime", Date>

// パターン2: input 1つ + output 複数
export type DateTimeInput = DefineScalar<"DateTime", Date, "input">
export type DateTimeOutput1 = DefineScalar<"DateTime", Date, "output">
export type DateTimeOutput2 = DefineScalar<"DateTime", string, "output">
```

この場合の型パラメータ:
- パターン1: `GraphQLScalarType<DateTime, DateTime>`
- パターン2: `GraphQLScalarType<DateTimeInput, DateTimeOutput1 | DateTimeOutput2>`

#### 7. Description の生成

scalar の description は対応する TypeScript 型の TSDoc コメントから取得する：

```typescript
/**
 * ISO 8601 形式の日時を表す
 */
export type DateTime = DefineScalar<"DateTime", Date>

/**
 * Unix timestamp としても表現可能
 */
export type DateTimeNumber = DefineScalar<"DateTime", number>
```

同一 scalar に複数の型がある場合、description は空行区切りで結合される。
結合順序: ファイルパス alphabetical → ファイル内登場順

生成結果:
```graphql
"""
ISO 8601 形式の日時を表す

Unix timestamp としても表現可能
"""
scalar DateTime
```

#### 8. エラー検出

以下のケースでコード解析時にエラーを出力する：

**`only` 違反:**
- `only: "output"` の型を input position（input type のフィールド、resolver の引数型）で使用
- `only: "input"` の型を output position（object type のフィールド、resolver の返り値型）で使用

**異なる scalar の union:**
- `Int | IDString` のような異なる scalar 型の union は GraphQL で表現できないためエラー

**input 型の複数マッピング:**
- 同一 custom scalar に対して input 用の型が複数検出された場合はエラー
- 例: `only: "input"` が複数、`only` なしが複数、または両者の混在

```typescript
// エラー例1: only: "input" が複数
export type DateTimeInput1 = DefineScalar<"DateTime", Date, "input">
export type DateTimeInput2 = DefineScalar<"DateTime", string, "input">  // エラー

// エラー例2: only なしが複数
export type DateTime1 = DefineScalar<"DateTime", Date>
export type DateTime2 = DefineScalar<"DateTime", string>  // エラー（input 側が複数になる）

// エラー例3: only なしと only: "input" の混在
export type DateTime = DefineScalar<"DateTime", Date>
export type DateTimeInput = DefineScalar<"DateTime", string, "input">  // エラー
```

**input/output 型の不足:**
- custom scalar に output 用の型が1つもない場合はエラー
- custom scalar に input 用の型がない場合はエラー

```typescript
// エラー例: output のみ定義（input がない）
export type DateTimeOutput = DefineScalar<"DateTime", Date, "output">  // エラー
```

#### 9. Built-in Scalar の扱い

GraphQL の built-in scalar（String, Boolean, Float, Int, ID）について：
- `String`, `Boolean`, `Float` は TypeScript プリミティブからの自動マッピングで対応
- `Int`, `ID` は runtime 提供の metadata 付き型を使用
- ユーザーが sourceDir 内で同名の型を定義してもエラーにはならない（衝突しない）

#### 10. Nullable / List との組み合わせ

metadata 付き型は nullable や list と組み合わせて使用できる：

```typescript
type User = {
  age: Int | null           // nullable Int → Int
  scores: Int[]             // list of Int → [Int!]!
  tags: (Int | null)[]      // list of nullable Int → [Int]!
  optionalScores: Int[] | null  // nullable list → [Int!]
}
```

union 型から scalar metadata を検出する際は、union の各メンバーを走査して metadata を持つ型を特定する。`null` は nullable の表現として扱い、scalar metadata の検出からは除外する。

#### 11. 型エイリアスの連鎖

型エイリアスを経由した場合でも、TypeScript の型情報から metadata を正しく検出する：

```typescript
type MyInt = Int
type AnotherInt = MyInt

type User = {
  count: AnotherInt  // Int として認識される
}
```

#### 12. 既存機能との互換性

- `gqlkit.config.ts` での scalar 設定は新しい形式に変更（4.1 参照）
- 既存の `" $gqlkitResolver "` metadata パターンとの一貫性を保つ
- resolver の定義方法（defineQuery, defineMutation, defineField）は変更なし

### 影響範囲

#### packages/runtime
- `Int`, `Float`, `IDString`, `IDNumber` の型定義を metadata 付きに変更
- `DefineScalar` utility type を新規追加

#### packages/cli
- `type-extractor`: scalar metadata 検出ロジックの実装
- `resolver-extractor`: input/output position での `only` 検証
- `schema-generator`: custom scalar の AST 生成、description 結合
- `gen-orchestrator`: `createResolvers` 関数の生成

#### 設定
- `gqlkit.config.ts` の `scalars` オプションを新しい形式に変更（TypeScript 型 → GraphQL scalar のマッピング定義）

### 非機能要件

- 型エイリアスの連鎖を再帰的に辿っても十分なパフォーマンスを維持
- エラーメッセージは actionable で、問題の箇所と修正方法を明示

## Introduction

本ドキュメントは gqlkit の scalar 型システムを metadata ベースに移行するための要件を定義する。この機能により、TypeScript の型情報に埋め込まれた metadata を通じて scalar 型を検出・管理し、input/output で異なる型を使用するユースケースに対応可能となる。

## Requirements

### Requirement 1: TypeScript プリミティブ型の自動マッピング
**Objective:** As a gqlkit ユーザー, I want TypeScript プリミティブ型が自動的に GraphQL 型にマッピングされること, so that 基本的な型定義を簡潔に記述できる

#### Acceptance Criteria
1. When TypeScript の `string` 型がフィールドに使用された場合, the type-extractor shall GraphQL の `String` 型としてマッピングする
2. When TypeScript の `boolean` 型がフィールドに使用された場合, the type-extractor shall GraphQL の `Boolean` 型としてマッピングする
3. When TypeScript の `number` 型がフィールドに使用された場合, the type-extractor shall GraphQL の `Float` 型としてマッピングする

### Requirement 2: Scalar Metadata 構造の検出
**Objective:** As a gqlkit ユーザー, I want scalar metadata を持つ intersection type が正しく認識されること, so that 明示的に GraphQL scalar 型を指定できる

#### Acceptance Criteria
1. When 型が ` $gqlkitScalar` プロパティを持つ intersection type である場合, the type-extractor shall その型を scalar 型として認識する
2. When scalar metadata に `name` プロパティが含まれる場合, the type-extractor shall その値を GraphQL scalar 名として使用する
3. When scalar metadata に `only: "input"` が指定された場合, the type-extractor shall その型を input 専用として記録する
4. When scalar metadata に `only: "output"` が指定された場合, the type-extractor shall その型を output 専用として記録する
5. When scalar metadata に `only` が省略された場合, the type-extractor shall その型を input/output 両方で使用可能として記録する

### Requirement 3: Runtime 提供の Built-in Scalar 型
**Objective:** As a gqlkit ユーザー, I want `@gqlkit-ts/runtime` から提供される型を使って GraphQL の built-in scalar を表現できること, so that Int や ID を明示的に指定できる

#### Acceptance Criteria
1. The runtime package shall `Int` 型を `number & { " $gqlkitScalar"?: { name: "Int" } }` として export する
2. The runtime package shall `Float` 型を `number & { " $gqlkitScalar"?: { name: "Float" } }` として export する
3. The runtime package shall `IDString` 型を `string & { " $gqlkitScalar"?: { name: "ID" } }` として export する
4. The runtime package shall `IDNumber` 型を `number & { " $gqlkitScalar"?: { name: "ID" } }` として export する
5. When フィールドで `Int` 型が使用された場合, the type-extractor shall GraphQL の `Int` 型としてマッピングする
6. When フィールドで `IDString` または `IDNumber` 型が使用された場合, the type-extractor shall GraphQL の `ID` 型としてマッピングする

### Requirement 4: DefineScalar Utility Type の提供
**Objective:** As a gqlkit ユーザー, I want `DefineScalar` utility type を使って custom scalar を定義できること, so that 型安全に独自の scalar 型を作成できる

#### Acceptance Criteria
1. The runtime package shall `DefineScalar<Name, Base, Only>` utility type を export する
2. When `DefineScalar<"DateTime", Date>` のように使用された場合, the type-extractor shall `DateTime` という名前の scalar 型として認識する
3. When `DefineScalar<"DateTime", Date, "input">` のように使用された場合, the type-extractor shall input 専用の scalar 型として認識する
4. When `DefineScalar<"DateTime", Date, "output">` のように使用された場合, the type-extractor shall output 専用の scalar 型として認識する

### Requirement 5: sourceDir からの Custom Scalar 自動検出
**Objective:** As a gqlkit ユーザー, I want sourceDir 内で export した scalar metadata 付き型が自動的に GraphQL schema に含まれること, so that 設定ファイルなしで custom scalar を定義できる

#### Acceptance Criteria
1. When sourceDir 内のファイルで scalar metadata 付き型が export された場合, the schema-generator shall その scalar を GraphQL schema の scalar 定義として生成する
2. When 同一 scalar 名に対して複数の TypeScript 型が定義された場合, the schema-generator shall それらを1つの GraphQL scalar 定義にまとめる

### Requirement 6: 設定ファイルによる Custom Scalar マッピング
**Objective:** As a gqlkit ユーザー, I want `gqlkit.config.ts` で TypeScript 型を custom scalar にマッピングできること, so that DefineScalar を使用できない外部型にも対応できる

#### Acceptance Criteria
1. When `scalars` 設定で `name` と `tsType.name` が指定された場合, the config-loader shall そのマッピングを scalar 設定として読み込む
2. When `tsType.from` が指定された場合, the type-extractor shall そのモジュールからの型のみをマッピング対象とする
3. When `tsType.from` が省略された場合, the type-extractor shall グローバルな型としてマッピングする
4. When `only` が指定された場合, the type-extractor shall その用途制限を適用する
5. When `description` が指定された場合, the schema-generator shall その値を scalar の description に含める
6. When DefineScalar と設定ファイルの両方で同一 scalar が定義された場合, the schema-generator shall 両方のマッピングを有効な型マッピングとして扱う

### Requirement 7: createResolvers 関数の生成
**Objective:** As a gqlkit ユーザー, I want 生成される resolvers.ts が custom scalar の実装を受け取る関数として export されること, so that 型安全に scalar resolver を注入できる

#### Acceptance Criteria
1. When custom scalar が定義されている場合, the gen-orchestrator shall `createResolvers({ scalars: {...} })` 形式の関数を生成する
2. When custom scalar が定義されている場合, the gen-orchestrator shall scalars 引数に各 scalar の `GraphQLScalarType<TInput, TOutput>` 型を要求する
3. When custom scalar が定義されていない場合, the gen-orchestrator shall 引数なしの `createResolvers()` 関数を生成する
4. The gen-orchestrator shall 生成された関数が Query, Mutation resolver と共に scalar resolver を含む Resolvers オブジェクトを返すようにする

### Requirement 8: Scalar 型パラメータの収集
**Objective:** As a gqlkit ユーザー, I want 同一 scalar に対する複数の TypeScript 型が正しく input/output 用に収集されること, so that serialize と parseValue で異なる型を使い分けられる

#### Acceptance Criteria
1. When scalar に `only` なしの型が1つだけ定義された場合, the type-extractor shall その型を input/output 両方の型パラメータとして使用する
2. When scalar に `only: "input"` の型が定義された場合, the type-extractor shall その型を input 用の型パラメータとして使用する
3. When scalar に複数の `only: "output"` の型が定義された場合, the type-extractor shall それらの union を output 用の型パラメータとして構築する
4. When scalar に `only` なしの型と `only: "output"` の型が混在する場合, the type-extractor shall それらすべてを output 用の型パラメータの union に含める

### Requirement 9: Scalar Description の生成
**Objective:** As a gqlkit ユーザー, I want TypeScript 型の TSDoc コメントが GraphQL scalar の description として使用されること, so that ドキュメントを一元管理できる

#### Acceptance Criteria
1. When scalar metadata 付き型に TSDoc コメントがある場合, the schema-generator shall そのコメントを scalar の description として使用する
2. When 同一 scalar に複数の型がありそれぞれに TSDoc コメントがある場合, the schema-generator shall それらを空行区切りで結合する
3. When 複数の description を結合する場合, the schema-generator shall ファイルパスの alphabetical 順、同一ファイル内では登場順で結合する
4. When 設定ファイルで description が指定された場合, the schema-generator shall その description も TSDoc コメントと結合する

### Requirement 10: only 制約の検証
**Objective:** As a gqlkit ユーザー, I want `only` 制約に違反した型使用がエラーとして検出されること, so that 型の誤用を早期に発見できる

#### Acceptance Criteria
1. If `only: "output"` の型が input type のフィールドで使用された場合, then the resolver-extractor shall エラーを出力する
2. If `only: "output"` の型が resolver の引数型で使用された場合, then the resolver-extractor shall エラーを出力する
3. If `only: "input"` の型が object type のフィールドで使用された場合, then the resolver-extractor shall エラーを出力する
4. If `only: "input"` の型が resolver の返り値型で使用された場合, then the resolver-extractor shall エラーを出力する

### Requirement 11: Scalar Union のエラー検出
**Objective:** As a gqlkit ユーザー, I want 異なる scalar 型の union がエラーとして検出されること, so that GraphQL で表現できない型の使用を防げる

#### Acceptance Criteria
1. If フィールドの型が `Int | IDString` のような異なる scalar の union である場合, then the type-extractor shall エラーを出力する
2. The type-extractor shall エラーメッセージに問題のある union の各 scalar 名を含める

### Requirement 12: Input 型の複数マッピングエラー検出
**Objective:** As a gqlkit ユーザー, I want 同一 scalar に対する input 型の複数定義がエラーとして検出されること, so that parseValue の型曖昧性を防げる

#### Acceptance Criteria
1. If 同一 scalar に `only: "input"` の型が複数定義された場合, then the type-extractor shall エラーを出力する
2. If 同一 scalar に `only` なしの型が複数定義された場合, then the type-extractor shall エラーを出力する
3. If 同一 scalar に `only` なしの型と `only: "input"` の型が両方定義された場合, then the type-extractor shall エラーを出力する
4. The type-extractor shall エラーメッセージに競合している型の名前と定義場所を含める

### Requirement 13: Input/Output 型の不足エラー検出
**Objective:** As a gqlkit ユーザー, I want custom scalar に必要な型が不足している場合にエラーが検出されること, so that 不完全な scalar 定義を防げる

#### Acceptance Criteria
1. If custom scalar に output 用の型が1つも定義されていない場合, then the type-extractor shall エラーを出力する
2. If custom scalar に input 用の型が定義されていない場合, then the type-extractor shall エラーを出力する
3. The type-extractor shall エラーメッセージに不足している型の用途（input/output）を明示する

### Requirement 14: Built-in Scalar との衝突回避
**Objective:** As a gqlkit ユーザー, I want ユーザー定義の型と built-in scalar が衝突しないこと, so that 柔軟に型を定義できる

#### Acceptance Criteria
1. When ユーザーが sourceDir 内で `String`, `Boolean`, `Float`, `Int`, `ID` と同名の型を定義した場合, the type-extractor shall エラーを出力せずに処理を継続する
2. The type-extractor shall built-in scalar の検出は TypeScript プリミティブおよび runtime 提供型のみで行う

### Requirement 15: Nullable / List との組み合わせ
**Objective:** As a gqlkit ユーザー, I want scalar metadata 付き型を nullable や list と組み合わせて使用できること, so that 柔軟なスキーマを定義できる

#### Acceptance Criteria
1. When scalar metadata 付き型が `| null` と union された場合, the type-extractor shall nullable な scalar 型として認識する
2. When scalar metadata 付き型が配列型で使用された場合, the type-extractor shall list of scalar として認識する
3. When `(ScalarType | null)[]` の形式で使用された場合, the type-extractor shall nullable な要素を持つ list として認識する
4. When `ScalarType[] | null` の形式で使用された場合, the type-extractor shall nullable な list として認識する
5. When union 型から scalar metadata を検出する際, the type-extractor shall `null` を除外して metadata を持つ型を特定する

### Requirement 16: 型エイリアスの連鎖サポート
**Objective:** As a gqlkit ユーザー, I want 型エイリアスを経由しても scalar metadata が正しく検出されること, so that 型の再利用ができる

#### Acceptance Criteria
1. When scalar metadata 付き型に対する型エイリアスが定義された場合, the type-extractor shall 元の scalar metadata を検出する
2. When 複数段階の型エイリアス連鎖がある場合, the type-extractor shall 再帰的に辿って元の scalar metadata を検出する
3. While 型エイリアスの連鎖を辿る際, the type-extractor shall 実用的な時間内に処理を完了する

### Requirement 17: 既存機能との互換性
**Objective:** As a gqlkit ユーザー, I want 既存の resolver 定義方法や metadata パターンが引き続き動作すること, so that 移行時の破壊的変更を最小限にできる

#### Acceptance Criteria
1. The resolver-extractor shall `defineQuery`, `defineMutation`, `defineField` の定義方法を引き続きサポートする
2. The type-extractor shall 既存の `" $gqlkitResolver "` metadata パターンを引き続き認識する
3. When `gqlkit.config.ts` で新形式の `scalars` 設定が使用された場合, the config-loader shall 正しく読み込む

### Requirement 18: エラーメッセージの品質
**Objective:** As a gqlkit ユーザー, I want エラーメッセージが actionable であること, so that 問題を迅速に修正できる

#### Acceptance Criteria
1. When scalar 関連のエラーが発生した場合, the CLI shall 問題のあるファイルパスと行番号を出力する
2. When scalar 関連のエラーが発生した場合, the CLI shall 問題の具体的な内容を出力する
3. When scalar 関連のエラーが発生した場合, the CLI shall 修正方法のヒントを出力する
