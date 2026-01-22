# Requirements Document

## Project Description (Input)
resolver 引数と同様に、返り値でも type の自動生成をしたい

- 命名ロジックは query, mutation であれば `${PascalCase<queryOrMutationName>}Payload`、object field であれば `${ObjectName}${PascalCase<fieldName>}Payload`
- object だけでなく、enum, union も対応する
- object の場合、その各フィールドで inline の object, enum, union があればそれらも対応する

```ts
export const updateUser = defineMutation<
  { input: { /* ... */} },
  { user: User }, //  `type UpdateUserPayload { user: User! }` が生成される
>(
  // ...
)
```

```ts
export type UpdateUserSuccess = { /* ... */ }
export type UpdateUserInvalidEmail = { /* ... */ }

export const updateUser = defineMutation<
  { input: { /* ... */} }, // input
  UpdateUserSuccess | UpdateUserInvalidEmail, //  `union UpdateUserPayload = UpdateUserSuccess | UpdateUserInvalidEmail` が生成される
>(
  // ...
)
```

## Introduction

本機能は、gqlkit の Define API (`defineQuery`, `defineMutation`, `defineField`) において、返り値の型からも GraphQL 型を自動生成する機能を追加する。既存の resolver 引数からの自動型生成と同様の仕組みで、返り値に指定されたインライン型を検出し、一貫した命名規則に基づいて GraphQL 型を生成する。

対象となる型は Object、Enum（文字列リテラルユニオン）、Union であり、Object 型の場合はそのフィールド内のネストしたインライン型も再帰的に処理する。

## Requirements

### Requirement 1: Query/Mutation の Payload 型自動生成

**Objective:** GraphQL API 開発者として、`defineQuery` や `defineMutation` の返り値にインラインオブジェクトを指定した場合に、適切な命名で GraphQL Object 型が自動生成されることで、冗長な型定義を省略できるようにしたい。

#### Acceptance Criteria
1. When `defineQuery` または `defineMutation` の返り値型としてインラインオブジェクト型が指定された場合, the gqlkit CLI shall `${PascalCase<resolverName>}Payload` という名前の GraphQL Object 型を生成する
2. When 生成された Payload 型のフィールドが nullable でない場合, the gqlkit CLI shall GraphQL スキーマで Non-Null (`!`) として定義する
3. When 生成された Payload 型のフィールドが配列型の場合, the gqlkit CLI shall 適切な GraphQL List 型として定義する
4. The gqlkit CLI shall インラインオブジェクト型の各フィールドに対して、既存の型変換ルール（スカラー型、branded 型、参照型）を適用する

### Requirement 2: Object Field の Payload 型自動生成

**Objective:** GraphQL API 開発者として、`defineField` の返り値にインラインオブジェクトを指定した場合に、親型名とフィールド名に基づいた命名で GraphQL Object 型が自動生成されることで、フィールドリゾルバの型定義を簡潔にしたい。

#### Acceptance Criteria
1. When `defineField` の返り値型としてインラインオブジェクト型が指定された場合, the gqlkit CLI shall `${ParentTypeName}${PascalCase<fieldName>}Payload` という名前の GraphQL Object 型を生成する
2. When 親型名がすでに PascalCase の場合, the gqlkit CLI shall 親型名をそのまま使用してペイロード型名を構成する
3. The gqlkit CLI shall フィールドリゾルバから生成されたペイロード型を、そのフィールドの返り値型として GraphQL スキーマに反映する

### Requirement 3: Union 型の Payload 自動生成

**Objective:** GraphQL API 開発者として、返り値型として名前付き型のユニオンを指定した場合に、GraphQL Union 型が自動生成されることで、エラーハンドリングや条件分岐を表現する型を簡潔に定義できるようにしたい。

#### Acceptance Criteria
1. When `defineQuery`, `defineMutation`, または `defineField` の返り値型として名前付きオブジェクト型のユニオンが指定された場合, the gqlkit CLI shall 対応する GraphQL Union 型を生成する
2. When Query/Mutation の返り値が Union 型の場合, the gqlkit CLI shall `${PascalCase<resolverName>}Payload` という名前の GraphQL Union 型を生成する
3. When Object Field の返り値が Union 型の場合, the gqlkit CLI shall `${ParentTypeName}${PascalCase<fieldName>}Payload` という名前の GraphQL Union 型を生成する
4. The gqlkit CLI shall Union 型のメンバーとして指定された各名前付き型を、GraphQL Union のメンバーとして含める

### Requirement 4: Enum 型の Payload 自動生成

**Objective:** GraphQL API 開発者として、返り値型として文字列リテラルユニオンを指定した場合に、GraphQL Enum 型が自動生成されることで、列挙値を簡潔に定義できるようにしたい。

#### Acceptance Criteria
1. When `defineQuery`, `defineMutation`, または `defineField` の返り値型として文字列リテラルユニオンが指定された場合, the gqlkit CLI shall 対応する GraphQL Enum 型を生成する
2. When Query/Mutation の返り値が文字列リテラルユニオンの場合, the gqlkit CLI shall `${PascalCase<resolverName>}Payload` という名前の GraphQL Enum 型を生成する
3. When Object Field の返り値が文字列リテラルユニオンの場合, the gqlkit CLI shall `${ParentTypeName}${PascalCase<fieldName>}Payload` という名前の GraphQL Enum 型を生成する
4. The gqlkit CLI shall 文字列リテラル値を SCREAMING_SNAKE_CASE に変換して GraphQL Enum 値として定義する
5. The gqlkit CLI shall TypeScript 文字列リテラルと GraphQL Enum 値の間のマッピングをリゾルバマップに含める

### Requirement 5: ネストしたインライン型の再帰的処理

**Objective:** GraphQL API 開発者として、Payload オブジェクト型のフィールドにインライン型（オブジェクト、ユニオン、Enum）がネストしている場合にも、それらが適切に自動生成されることで、複雑なレスポンス構造を簡潔に定義できるようにしたい。

#### Acceptance Criteria
1. When Payload オブジェクト型のフィールドにインラインオブジェクト型がネストしている場合, the gqlkit CLI shall `${PayloadTypeName}${PascalCase<fieldName>}` という名前の GraphQL Object 型を生成する
2. When Payload オブジェクト型のフィールドに文字列リテラルユニオンがネストしている場合, the gqlkit CLI shall `${PayloadTypeName}${PascalCase<fieldName>}` という名前の GraphQL Enum 型を生成する
3. When Payload オブジェクト型のフィールドに名前付き型のユニオンがネストしている場合, the gqlkit CLI shall `${PayloadTypeName}${PascalCase<fieldName>}` という名前の GraphQL Union 型を生成する
4. The gqlkit CLI shall ネストの深さに関係なく、全てのインライン型を再帰的に処理する
5. The gqlkit CLI shall 生成されたネスト型を、親のペイロード型から正しく参照する

### Requirement 6: 既存の名前付き型の優先

**Objective:** GraphQL API 開発者として、返り値型として既に定義された名前付き型を使用した場合は自動生成が行われず、既存の型が使用されることで、意図した型定義を維持できるようにしたい。

#### Acceptance Criteria
1. When 返り値型として `knownTypeNames` に含まれる名前付き型が使用された場合, the gqlkit CLI shall 新たな Payload 型を生成せず、その名前付き型への参照を維持する
2. When 返り値型としてユーティリティ型（Omit, Pick など）でラップされた型が使用された場合, the gqlkit CLI shall その型を展開してインラインオブジェクトとして Payload 型を生成する
3. The gqlkit CLI shall 2-phase 型抽出の仕組みを使用して、名前付き型とインライン型を正しく区別する

### Requirement 7: TSDoc コメントの継承

**Objective:** GraphQL API 開発者として、TypeScript のインライン型定義に付与した TSDoc コメントが生成される GraphQL 型の description として反映されることで、スキーマのドキュメントを維持できるようにしたい。

#### Acceptance Criteria
1. When インラインオブジェクト型のプロパティに TSDoc コメントが付与されている場合, the gqlkit CLI shall 生成される GraphQL Object 型のフィールド description としてそのコメントを含める
2. When インラインオブジェクト型自体に TSDoc コメントが付与されている場合, the gqlkit CLI shall 生成される GraphQL Object 型の description としてそのコメントを含める
3. When `@deprecated` タグが TSDoc コメントに含まれている場合, the gqlkit CLI shall 生成される GraphQL 型に `@deprecated` ディレクティブを付与する
