# Requirements Document

## Introduction
本ドキュメントは、gqlkit における GraphQL ディレクティブサポート機能の要件を定義します。この機能により、TypeScript の型定義およびリゾルバ定義にディレクティブ情報を付与し、生成される GraphQL スキーマにディレクティブを反映できるようになります。

## Project Description (Input)
graphql directive に対応させたい

## Directive の定義
`@gqlkit-ts/runtime` でディレクティブを定義するためのユーティリティ型を提供する

```ts
type DirectiveLocation =
  | "SCHEMA"
  | "SCALAR"
  | "OBJECT"
  | "FIELD_DEFINITION"
  | "ARGUMENT_DEFINITION"
  | "INTERFACE"
  | "UNION"
  | "ENUM"
  | "ENUM_VALUE"
  | "INPUT_OBJECT"
  | "INPUT_FIELD_DEFINITION";

export type Directive<Name, Args extends Record<string, unknown>, Location extends DirectiveLocation | DirectiveLocation[]> = {
  name: Name;
  args: Args;
  location: Location | Location[];
};
```

利用例

```ts
export type Role = "USER" | "ADMIN";
export type AuthDirective<TArgs extends { role: Role[] }> = Directive<"auth", TArgs, "FIELD_DEFINITION">;
```

生成されるスキーマ

```
directive @auth(roles: [Role!]!) on FIELD_DEFINITION
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
  id: WithDirectives<IDString, [AuthDirective<{ role: ["USER", "ADMIN"]> }]>;
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
  WithDirectives<User, [AuthDirective<{ role: ["USER"] }>]>
>((_root, _args, ctx) => {
  // ...
  return { id: "123" as IDString };
});
```

## Requirements

### Requirement 1: ディレクティブ定義のランタイム型
**Objective:** As a gqlkit ユーザー, I want TypeScript でディレクティブを型安全に定義できるようにしたい, so that ディレクティブの名前・引数・適用可能な場所を明示的に宣言し、型チェックによる安全性を確保できる

#### Acceptance Criteria
1. The @gqlkit-ts/runtime shall `Directive<Name, Args, Location>` ユーティリティ型をエクスポートする
2. When `Directive<Name, Args, Location>` 型を使用する, the @gqlkit-ts/runtime shall `Name` をディレクティブ名、`Args` を引数の型、`Location` を適用可能な場所として扱う
3. The `Args` 型パラメータ shall `Record<string, unknown>` を継承する制約を持つ
4. The `Location` 型パラメータ shall `DirectiveLocation` または `DirectiveLocation[]` を継承する制約を持つ
5. The @gqlkit-ts/runtime shall `DirectiveLocation` 型（GraphQL のディレクティブ適用可能場所を表す文字列リテラル型の和集合）をエクスポートする

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

### Requirement 4: ディレクティブ型定義の抽出
**Objective:** As a gqlkit CLI, I want ディレクティブ型定義（`Directive<Name, Args, Location>` を使った型エイリアス）を抽出したい, so that スキーマにディレクティブ定義を生成できる

#### Acceptance Criteria
1. When エクスポートされた型エイリアスが `Directive<Name, Args, Location>` を使用している, the type-extractor shall ディレクティブ定義として認識する
2. The type-extractor shall ディレクティブ定義からディレクティブ名（Name）を抽出する
3. The type-extractor shall ディレクティブ定義から引数の型（Args）を抽出する
4. The type-extractor shall ディレクティブ定義から適用可能な場所（Location）を抽出する
5. When ディレクティブ型がジェネリック型パラメータを持つ, the type-extractor shall 引数型の構造を解析する

### Requirement 5: 型定義からのディレクティブ使用の抽出
**Objective:** As a gqlkit CLI, I want TypeScript 型定義から `WithDirectives` によるディレクティブ使用情報を抽出したい, so that スキーマ生成時にディレクティブを型やフィールドに付与できる

#### Acceptance Criteria
1. When 型定義に `WithDirectives` が適用されている, the type-extractor shall 型レベルのディレクティブ使用情報を抽出する
2. When フィールドの型に `WithDirectives` が適用されている, the type-extractor shall フィールドレベルのディレクティブ使用情報を抽出する
3. The type-extractor shall ディレクティブの名前と引数の値を正確に解析する
4. When 複数のディレクティブが付与されている, the type-extractor shall すべてのディレクティブを順序を保持して抽出する
5. The type-extractor shall ディレクティブ引数の値を TypeScript の型リテラルから解決する

### Requirement 6: リゾルバ定義からのディレクティブ使用の抽出
**Objective:** As a gqlkit CLI, I want リゾルバ定義からディレクティブ使用情報を抽出したい, so that Query/Mutation フィールドにディレクティブを反映できる

#### Acceptance Criteria
1. When `defineQuery` の戻り値型に `WithDirectives` が適用されている, the resolver-extractor shall ディレクティブ使用情報を抽出する
2. When `defineMutation` の戻り値型に `WithDirectives` が適用されている, the resolver-extractor shall ディレクティブ使用情報を抽出する
3. When `defineField` の戻り値型に `WithDirectives` が適用されている, the resolver-extractor shall ディレクティブ使用情報を抽出する
4. The resolver-extractor shall 抽出したディレクティブ使用情報を対応するフィールドに関連付ける

### Requirement 7: ディレクティブ定義のスキーマ生成
**Objective:** As a gqlkit CLI, I want 抽出したディレクティブ型定義から GraphQL のディレクティブ定義を生成したい, so that 生成されるスキーマにディレクティブ定義が含まれる

#### Acceptance Criteria
1. When ディレクティブ型定義が抽出されている, the schema-generator shall `directive @name(...) on LOCATION` 形式のディレクティブ定義を生成する
2. The schema-generator shall ディレクティブ引数の型を GraphQL の引数形式で出力する
3. When ディレクティブ引数の型が GraphQL 型への参照を含む, the schema-generator shall 対応する GraphQL 型名を使用する
4. When Location が複数指定されている, the schema-generator shall すべての場所を `|` 区切りで出力する
5. The schema-generator shall ディレクティブ定義をスキーマ内の適切な位置に配置する

### Requirement 8: ディレクティブ使用のスキーマ出力
**Objective:** As a gqlkit CLI, I want 抽出したディレクティブ使用情報を GraphQL スキーマに反映したい, so that 生成されるスキーマの型やフィールドにディレクティブが付与される

#### Acceptance Criteria
1. When 型にディレクティブが付与されている, the schema-generator shall 型定義にディレクティブを出力する
2. When オブジェクト型のフィールドにディレクティブが付与されている, the schema-generator shall フィールド定義にディレクティブを出力する
3. When Query/Mutation フィールドにディレクティブが付与されている, the schema-generator shall 該当フィールドにディレクティブを出力する
4. The schema-generator shall ディレクティブ引数を GraphQL の引数形式（`@name(arg: value)`）で出力する
5. When 複数のディレクティブが付与されている, the schema-generator shall すべてのディレクティブを定義順に出力する

### Requirement 9: ディレクティブのバリデーション
**Objective:** As a gqlkit CLI, I want ディレクティブの使用に対してバリデーションを行いたい, so that 不正なディレクティブ使用を早期に検出できる

#### Acceptance Criteria
1. If ディレクティブ引数の値が解決できない, then the gqlkit CLI shall 診断エラーを報告する
2. If ディレクティブの名前が空文字列である, then the gqlkit CLI shall 診断エラーを報告する
3. If ディレクティブが定義された Location と異なる場所で使用されている, then the gqlkit CLI shall 診断エラーを報告する
4. If 使用されているディレクティブに対応するディレクティブ型定義が見つからない, then the gqlkit CLI shall 診断警告を報告する
5. The 診断メッセージ shall ディレクティブの使用箇所（ファイル、行番号）を含む
