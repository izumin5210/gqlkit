# Requirements Document

## Introduction

GraphQL の union 型と interface 型（抽象型）では、実行時に具体的な型を解決するために `resolveType` や `isTypeOf` 関数が必要となる。本機能は、gqlkit の既存の Define API パターン（`defineQuery`、`defineMutation`、`defineField`）と一貫性のある方法で、ユーザーがこれらの型解決関数を定義できるようにする。

主な目的:
- `defineResolveType<TAbstract>` - union/interface 型に対する型解決関数の定義
- `defineIsTypeOf<TObject>` - object 型に対する型判定関数の定義
- gqlkit CLI による自動抽出と resolver map への統合

## Requirements

### Requirement 1: defineResolveType API

**Objective:** GraphQL 開発者として、union 型や interface 型に対して型解決ロジックを定義したい。これにより、実行時に正しい具体型が返されるようになる。

#### Acceptance Criteria

1. The `@gqlkit-ts/runtime` shall export a `defineResolveType<TAbstract>` 関数 that accepts a resolver function and returns metadata-embedded function.
2. When `defineResolveType<TAbstract>` が呼び出された時, the runtime shall require a function with signature `(value: TAbstract, context: TContext, info: GraphQLResolveInfo) => string | Promise<string>`.
3. The runtime shall embed metadata with `kind: "resolveType"` and the abstract type reference in the returned function.
4. When ユーザーが union 型以外の型パラメータを指定した場合でも, the runtime shall accept any type parameter to maintain flexibility for interface types.

### Requirement 2: defineIsTypeOf API

**Objective:** GraphQL 開発者として、object 型に対して型判定ロジックを定義したい。これにより、抽象型から具体型への解決時に正しく判定できるようになる。

#### Acceptance Criteria

1. The `@gqlkit-ts/runtime` shall export a `defineIsTypeOf<TObject>` 関数 that accepts a resolver function and returns metadata-embedded function.
2. When `defineIsTypeOf<TObject>` が呼び出された時, the runtime shall require a function with signature `(value: unknown, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>`.
3. The runtime shall embed metadata with `kind: "isTypeOf"` and the object type reference in the returned function.
4. The runtime shall allow `value` parameter to be typed as `unknown` since the actual value type is determined at runtime.

### Requirement 3: GqlkitApis への統合

**Objective:** GraphQL 開発者として、既存の `createGqlkitApis<TContext>()` から `defineResolveType` と `defineIsTypeOf` を取得したい。これにより、コンテキスト型の一貫性が保たれる。

#### Acceptance Criteria

1. When `createGqlkitApis<TContext>()` が呼び出された時, the returned object shall include `defineResolveType` and `defineIsTypeOf` functions with the specified context type.
2. The `defineResolveType` returned by `createGqlkitApis<TContext>()` shall use `TContext` as the context parameter type.
3. The `defineIsTypeOf` returned by `createGqlkitApis<TContext>()` shall use `TContext` as the context parameter type.
4. The resolver-extractor shall extract abstract type resolvers from exported functions that have gqlkit metadata markers.

### Requirement 4: CLI による抽出

**Objective:** gqlkit CLI として、スキーマディレクトリから抽象型リゾルバをエクスポート名とメタデータに基づいて自動抽出したい。これにより、手動設定なしで resolver map に統合できる。

#### Acceptance Criteria

1. When `gqlkit gen` が実行された時, the resolver-extractor shall detect exported functions with `$gqlkitAbstractResolver` metadata.
2. When resolveType 関数が検出された時, the resolver-extractor shall extract the abstract type name from the type parameter metadata.
3. When isTypeOf 関数が検出された時, the resolver-extractor shall extract the object type name from the type parameter metadata.
4. The resolver-extractor shall record the source location for error reporting purposes.
5. The `ExtractResolversResult` shall be extended to include `abstractTypeResolvers` containing resolveType and isTypeOf definitions.

### Requirement 5: Resolver Map への統合

**Objective:** gqlkit CLI として、抽出した抽象型リゾルバを GraphQL resolver map に正しく配置したい。これにより、graphql-tools の `makeExecutableSchema` と互換性のある出力が得られる。

#### Acceptance Criteria

1. When resolveType が union 型に対して定義されている時, the schema-generator shall place it as `__resolveType` in the union type's resolver object.
2. When resolveType が interface 型に対して定義されている時, the schema-generator shall place it as `__resolveType` in the interface type's resolver object.
3. When isTypeOf が object 型に対して定義されている時, the schema-generator shall place it as `__isTypeOf` in the object type's resolver object.
4. The generated resolver map shall maintain the same export pattern as existing resolvers (`export const resolvers = { ... }`).

### Requirement 6: 型参照の検証

**Objective:** gqlkit CLI として、抽象型リゾルバで参照されている型が実際にスキーマに存在することを検証したい。これにより、実行時エラーを防ぐことができる。

#### Acceptance Criteria

1. If resolveType で参照された型がスキーマに存在しない場合, then the CLI shall emit a diagnostic error with the type name and source location.
2. If resolveType で参照された型が union でも interface でもない場合, then the CLI shall emit a diagnostic error indicating the type must be abstract.
3. If isTypeOf で参照された型がスキーマに存在しない場合, then the CLI shall emit a diagnostic error with the type name and source location.
4. If isTypeOf で参照された型が object 型でない場合, then the CLI shall emit a diagnostic error indicating the type must be an object type.

### Requirement 7: 重複定義の検出

**Objective:** gqlkit CLI として、同一の抽象型に対する重複した型解決関数の定義を検出したい。これにより、意図しない動作を防ぐことができる。

#### Acceptance Criteria

1. If 同一の union/interface 型に対して複数の resolveType が定義された場合, then the CLI shall emit a diagnostic error listing all duplicate definitions with their source locations.
2. If 同一の object 型に対して複数の isTypeOf が定義された場合, then the CLI shall emit a diagnostic error listing all duplicate definitions with their source locations.
3. The CLI shall report all duplicates in a single diagnostic rather than failing on the first occurrence.

### Requirement 8: エラーメッセージの品質

**Objective:** gqlkit ユーザーとして、問題発生時に明確で実用的なエラーメッセージを受け取りたい。これにより、迅速に問題を特定し修正できる。

#### Acceptance Criteria

1. When 型参照エラーが発生した時, the error message shall include the referenced type name, the source file path, and the line number.
2. When 型の種類が不正な場合, the error message shall indicate what type kind was expected and what was found.
3. When 重複定義エラーが発生した時, the error message shall list all conflicting definitions with their respective file paths and line numbers.
4. The CLI shall use consistent error message format following existing gqlkit diagnostic patterns.

### Requirement 9: 抽象型リゾルバ未定義時の動作

**Objective:** gqlkit CLI として、抽象型に対して resolveType も isTypeOf も定義されていない場合に警告を出したい。これにより、実行時の型解決エラーを防ぐことができる。

#### Acceptance Criteria

1. While union 型がスキーマに存在する時, if その union 型に resolveType が定義されておらず、かつ構成する object 型に isTypeOf も定義されていない場合, then the CLI shall emit a diagnostic warning.
2. While interface 型がスキーマに存在する時, if その interface 型に resolveType が定義されておらず、かつ実装する object 型に isTypeOf も定義されていない場合, then the CLI shall emit a diagnostic warning.
3. The warning message shall suggest either defining `resolveType` for the abstract type or `isTypeOf` for each implementing/member type.
4. The warning shall not block code generation but shall be displayed to the user.

### Requirement 10: 命名規則

**Objective:** gqlkit ユーザーとして、エクスポート名から抽象型リゾルバの対象型を推測できる命名規則に従いたい。これにより、コードの可読性が向上する。

#### Acceptance Criteria

1. The CLI shall not enforce any specific naming convention for abstract type resolver exports.
2. The CLI shall determine the target type solely from the type parameter metadata, not from the export name.
3. The documentation shall recommend naming patterns such as `{typeName}ResolveType` for resolveType and `{typeName}IsTypeOf` for isTypeOf for code readability.

