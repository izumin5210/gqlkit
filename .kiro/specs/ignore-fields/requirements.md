# Requirements Document

## Introduction

本機能は、TypeScript で GraphQL Object Type または Input Object Type を定義する際に、特定のフィールドを GraphQL スキーマから除外する機能を提供する。`GqlObject<T, { ignoreFields: "fieldName" | "anotherField" }>` のように string literal union で除外対象のフィールド名を指定することで、TypeScript 型には存在するが GraphQL スキーマには露出しないフィールドを宣言できる。

この機能により、内部ロジックで使用するフィールドを GraphQL API から隠蔽しつつ、TypeScript の型安全性を維持できる。

## Requirements

### Requirement 1: ignoreFields メタデータの定義

**Objective:** As a gqlkit ユーザー, I want GqlObject の第2型引数で ignoreFields を指定できる, so that 特定のフィールドを GraphQL スキーマから除外できる

#### Acceptance Criteria
1. The gqlkit runtime shall provide `ignoreFields` property in `GqlObject` metadata type parameter accepting a string literal union of field names
2. When `GqlObject<T, { ignoreFields: K }>` が指定された場合, the gqlkit CLI shall exclude fields named in `K` from the generated GraphQL schema
3. When `ignoreFields` が指定されていない場合, the gqlkit CLI shall include all fields from the TypeScript type in the GraphQL schema

### Requirement 2: Object Type における ignoreFields サポート

**Objective:** As a gqlkit ユーザー, I want Object Type 定義で ignoreFields を使用できる, so that 内部フィールドを GraphQL API から隠蔽できる

#### Acceptance Criteria
1. When Object Type が `GqlObject<T, { ignoreFields: K }>` で定義された場合, the gqlkit CLI shall generate GraphQL Object Type definition excluding fields specified in `K`
2. When ignoreFields で指定されたフィールドがある場合, the gqlkit CLI shall not generate field resolvers for the excluded fields
3. The gqlkit CLI shall preserve all non-excluded fields with their original types and descriptions in the generated schema

### Requirement 3: Input Object Type における ignoreFields サポート

**Objective:** As a gqlkit ユーザー, I want Input Object Type 定義で ignoreFields を使用できる, so that 内部処理用のフィールドを GraphQL 入力から除外できる

#### Acceptance Criteria
1. When Input Object Type が `GqlObject<T, { ignoreFields: K }>` で定義された場合, the gqlkit CLI shall generate GraphQL Input Object Type definition excluding fields specified in `K`
2. The gqlkit CLI shall preserve all non-excluded input fields with their original types, descriptions, and default values

### Requirement 4: 既存メタデータとの併用

**Objective:** As a gqlkit ユーザー, I want ignoreFields を他のメタデータオプションと併用できる, so that 柔軟な型定義ができる

#### Acceptance Criteria
1. When `GqlObject<T, { ignoreFields: K, implements: [...] }>` が指定された場合, the gqlkit CLI shall apply both ignoreFields exclusion and interface implementation
2. When `GqlObject<T, { ignoreFields: K, directives: [...] }>` が指定された場合, the gqlkit CLI shall apply both ignoreFields exclusion and directives
3. The gqlkit CLI shall support combining ignoreFields with all existing GqlObject metadata options

### Requirement 5: バリデーションとエラーハンドリング

**Objective:** As a gqlkit ユーザー, I want 不正な ignoreFields 指定に対して明確なエラーを得られる, so that 問題を迅速に特定・修正できる

#### Acceptance Criteria
1. If ignoreFields で指定されたフィールド名が型に存在しない場合, the gqlkit CLI shall report an actionable error indicating the invalid field name and available fields
2. If ignoreFields によりすべてのフィールドが除外される場合, the gqlkit CLI shall report an error indicating that at least one field must remain
3. The gqlkit CLI shall validate ignoreFields at extraction phase before schema generation

### Requirement 6: Interface Type での ignoreFields 考慮

**Objective:** As a gqlkit ユーザー, I want Interface を実装する型で ignoreFields を使用した際に整合性が保たれる, so that 型安全なスキーマを生成できる

#### Acceptance Criteria
1. If ignoreFields で Interface の必須フィールドが除外される場合, the gqlkit CLI shall report an error indicating the interface contract violation
2. When Object Type が Interface を実装し ignoreFields を使用する場合, the gqlkit CLI shall verify that all interface fields remain in the generated type
