# Requirements Document

## Introduction
本ドキュメントは、gqlkit における GraphQL ディレクティブサポート機能の要件を定義します。この機能により、TypeScript の型定義およびリゾルバ定義にディレクティブ情報を付与し、生成される GraphQL スキーマにディレクティブを反映できるようになります。

## Project Description (Input)
graphql directive に対応させたい

## Directive の定義
`@gqlkit-ts/runtime` でディレクティブを定義するためのユーティリティ型を提供する

```ts
export type Directive<Name, Args extends Record<string, unknown>> = {
  name: Name;
  args: Args;
};
```

利用例

```ts
export type Role = "USER" | "ADMIN";
export type AuthDirective<R extends Role[]> = Directive<"auth", { roles: R }>;
```

## Directive の付与

型にディレクティブを付与するためのユーティリティ型を提供する。
このユーティリティ型を使うことで、型やフィールドの型情報上にメタデータを付与し、静的解析時の手がかりとする。

```ts
export type WithDirectives<
  T,
  Ds extends Directive<string, Record<string, unknown>>[],
> = T & { [" $gqlkitDirectives"]?: Ds };

export type QueryResolver<
  TArgs,
  TResult,
  TContext = unknown,
  TDirectives extends Directive<string, Record<string, unknown>>[] = [],
> = QueryResolverFn<
  │ TArgs,
  │ TResult,
  │ TContext
  > & { /* ... */ }
```

利用例

```ts
export type User = {
  // field directive
  id: WithDirectives<IDString, [AuthDirective<["USER", "ADMIN"]>]>;
};

// type directive
export type Post = WithDirectives<{
  // ...
}, [
  // ...
]>

export const me = defineQuery<
  NoArgs,
  User,
  // field directive
  WithDirectives<User, [AuthDirective<["USER"]>]>
>((_root, _args, ctx) => {
  // ...
  return { id: "123" as IDString };
});
```

## Requirements

### Requirement 1: ディレクティブ定義のランタイム型
**Objective:** As a gqlkit ユーザー, I want TypeScript でディレクティブを型安全に定義できるようにしたい, so that ディレクティブの名前と引数の型を明示的に宣言し、型チェックによる安全性を確保できる

#### Acceptance Criteria
1. The @gqlkit-ts/runtime shall `Directive<Name, Args>` ユーティリティ型をエクスポートする
2. When `Directive<Name, Args>` 型を使用する, the @gqlkit-ts/runtime shall `Name` をディレクティブ名、`Args` を引数の型として扱う
3. The `Args` 型パラメータ shall `Record<string, unknown>` を継承する制約を持つ

### Requirement 2: ディレクティブ付与のランタイム型
**Objective:** As a gqlkit ユーザー, I want 型やフィールドにディレクティブを付与できるようにしたい, so that スキーマ生成時にディレクティブ情報が反映される

#### Acceptance Criteria
1. The @gqlkit-ts/runtime shall `WithDirectives<T, Ds>` ユーティリティ型をエクスポートする
2. When `WithDirectives` を型に適用する, the @gqlkit-ts/runtime shall 元の型 `T` にディレクティブメタデータを付加した交差型を返す
3. The `WithDirectives` shall 複数のディレクティブを配列として受け付ける
4. The ディレクティブメタデータ shall ` $gqlkitDirectives` プロパティとして型情報に埋め込まれる

### Requirement 3: リゾルバ定義へのディレクティブ付与
**Objective:** As a gqlkit ユーザー, I want Query/Mutation/Field リゾルバにディレクティブを付与できるようにしたい, so that リゾルバで定義されるフィールドにディレクティブ情報を追加できる

#### Acceptance Criteria
1. The `defineQuery` shall 戻り値型パラメータに `WithDirectives` でラップした型を受け付ける
2. The `defineMutation` shall 戻り値型パラメータに `WithDirectives` でラップした型を受け付ける
3. The `defineField` shall 戻り値型パラメータに `WithDirectives` でラップした型を受け付ける
4. When リゾルバの戻り値型に `WithDirectives` が適用されている, the リゾルバ定義 shall ディレクティブ情報を保持する

### Requirement 4: 型定義からのディレクティブ抽出
**Objective:** As a gqlkit CLI, I want TypeScript 型定義からディレクティブ情報を抽出したい, so that スキーマ生成に必要なディレクティブメタデータを収集できる

#### Acceptance Criteria
1. When 型定義に `WithDirectives` が適用されている, the type-extractor shall 型レベルのディレクティブ情報を抽出する
2. When フィールドの型に `WithDirectives` が適用されている, the type-extractor shall フィールドレベルのディレクティブ情報を抽出する
3. The type-extractor shall ディレクティブの名前と引数を正確に解析する
4. When 複数のディレクティブが付与されている, the type-extractor shall すべてのディレクティブを順序を保持して抽出する
5. The type-extractor shall ディレクティブ引数の値を TypeScript の型情報から解決する

### Requirement 5: リゾルバ定義からのディレクティブ抽出
**Objective:** As a gqlkit CLI, I want リゾルバ定義からディレクティブ情報を抽出したい, so that Query/Mutation フィールドにディレクティブを反映できる

#### Acceptance Criteria
1. When `defineQuery` の戻り値型に `WithDirectives` が適用されている, the resolver-extractor shall ディレクティブ情報を抽出する
2. When `defineMutation` の戻り値型に `WithDirectives` が適用されている, the resolver-extractor shall ディレクティブ情報を抽出する
3. When `defineField` の戻り値型に `WithDirectives` が適用されている, the resolver-extractor shall ディレクティブ情報を抽出する
4. The resolver-extractor shall 抽出したディレクティブ情報を対応するフィールドに関連付ける

### Requirement 6: GraphQL スキーマへのディレクティブ出力
**Objective:** As a gqlkit CLI, I want 抽出したディレクティブ情報を GraphQL スキーマに反映したい, so that 生成されるスキーマにディレクティブが含まれる

#### Acceptance Criteria
1. When 型にディレクティブが付与されている, the schema-generator shall 型定義にディレクティブを出力する
2. When オブジェクト型のフィールドにディレクティブが付与されている, the schema-generator shall フィールド定義にディレクティブを出力する
3. When Query/Mutation フィールドにディレクティブが付与されている, the schema-generator shall 該当フィールドにディレクティブを出力する
4. The schema-generator shall ディレクティブ引数を GraphQL の引数形式で出力する
5. When 複数のディレクティブが付与されている, the schema-generator shall すべてのディレクティブを定義順に出力する

### Requirement 7: ディレクティブのバリデーション
**Objective:** As a gqlkit CLI, I want ディレクティブの使用に対してバリデーションを行いたい, so that 不正なディレクティブ使用を早期に検出できる

#### Acceptance Criteria
1. If ディレクティブ引数の値が解決できない, then the gqlkit CLI shall 診断エラーを報告する
2. If ディレクティブの名前が空文字列である, then the gqlkit CLI shall 診断エラーを報告する
3. The 診断メッセージ shall ディレクティブの使用箇所（ファイル、行番号）を含む
