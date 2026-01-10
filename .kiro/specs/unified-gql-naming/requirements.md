# Requirements Document

## Introduction

`@gqlkit-ts/runtime` パッケージが提供する GraphQL スキーマ定義用ユーティリティタイプの命名規則を統一する。現在、`DefineInterface`、`DefineScalar`、`Directive` といった型名と、`GqlTypeDef`、`GqlFieldDef` といった `Def` サフィックスを持つ型名が混在しているため、これらを `GqlXxx` パターン（プレフィックス統一 + サフィックス削除）に統一し、API の一貫性と発見可能性を向上させる。

**重要**: 本プロジェクトは未リリースのため、後方互換性は不要。旧型名は完全に削除し、新型名のみを残す。

**対象となる公開型の変更:**
- `DefineInterface<T, Meta?>` -> `GqlInterface<T, Meta?>`
- `DefineScalar<Name, Base, Only?>` -> `GqlScalar<Name, Base, Only?>`
- `Directive<Name, Args, Location>` -> `GqlDirective<Name, Args, Location>`
- `GqlTypeDef<T, Meta>` -> `GqlObject<T, Meta>`
- `GqlFieldDef<T, Meta>` -> `GqlField<T, Meta>`

**対象となる内部型の変更:**
- 公開型に対応する内部型は、公開型の命名規則に準じてリネームする
- 例: `DefineInterfaceMarker` -> `GqlInterfaceMarker`

## Requirements

### Requirement 1: ユーティリティタイプの命名規則統一

**Objective:** As a gqlkit ユーザー, I want GraphQL スキーマ定義用のユーティリティタイプが一貫した命名規則に従っていること, so that API の発見可能性が向上し、学習コストが下がる

#### Acceptance Criteria

1. The @gqlkit-ts/runtime shall export `GqlInterface<T, Meta?>` as a utility type for defining GraphQL interface types
2. The @gqlkit-ts/runtime shall export `GqlScalar<Name, Base, Only?>` as a utility type for defining custom scalar types
3. The @gqlkit-ts/runtime shall export `GqlDirective<Name, Args, Location>` as a utility type for defining custom directives
4. The @gqlkit-ts/runtime shall export `GqlObject<T, Meta>` as a utility type for attaching type-level metadata (implements, directives) to GraphQL object types
5. The @gqlkit-ts/runtime shall export `GqlField<T, Meta>` as a utility type for attaching field-level metadata (defaultValue, directives) to GraphQL fields
6. When a user imports utility types from @gqlkit-ts/runtime, the @gqlkit-ts/runtime shall provide all GraphQL schema definition types with the `Gql` prefix naming pattern without `Def` suffix
7. The @gqlkit-ts/runtime shall maintain the same type parameters and behavior for renamed types as their original counterparts

### Requirement 2: 旧型名の完全削除

**Objective:** As a gqlkit 開発者, I want 旧型名が完全に削除されていること, so that コードベースに一貫性のない命名が残らない

#### Acceptance Criteria

1. The @gqlkit-ts/runtime shall NOT export `DefineInterface` (旧型名)
2. The @gqlkit-ts/runtime shall NOT export `DefineScalar` (旧型名)
3. The @gqlkit-ts/runtime shall NOT export `Directive` (旧型名)
4. The @gqlkit-ts/runtime shall NOT export `GqlTypeDef` (旧型名)
5. The @gqlkit-ts/runtime shall NOT export `GqlFieldDef` (旧型名)
6. The @gqlkit-ts/runtime shall NOT contain any deprecated type aliases for backward compatibility
7. Internal types that correspond to public types shall be renamed following the same naming convention (e.g., `DefineInterfaceMarker` -> `GqlInterfaceMarker`)

### Requirement 3: CLI 型認識の対応

**Objective:** As a gqlkit ユーザー, I want CLI が新しい型名を認識してスキーマを生成できること, so that 正常にコード生成が動作する

#### Acceptance Criteria

1. When the CLI analyzes TypeScript source files, the @gqlkit-ts/cli shall recognize `GqlInterface` as a GraphQL interface type definition
2. When the CLI analyzes TypeScript source files, the @gqlkit-ts/cli shall recognize `GqlScalar` as a custom scalar type definition
3. When the CLI analyzes TypeScript source files, the @gqlkit-ts/cli shall recognize `GqlDirective` as a custom directive definition
4. When the CLI analyzes TypeScript source files, the @gqlkit-ts/cli shall recognize `GqlObject` as type-level metadata for GraphQL object types
5. When the CLI analyzes TypeScript source files, the @gqlkit-ts/cli shall recognize `GqlField` as field-level metadata for GraphQL fields
6. The @gqlkit-ts/cli shall NOT recognize old type names (`DefineInterface`, `DefineScalar`, `Directive`, `GqlTypeDef`, `GqlFieldDef`)
7. All string-based type name detection in CLI source code shall be updated to use new type names only

### Requirement 4: テストデータの更新

**Objective:** As a gqlkit 開発者, I want すべてのテストデータが新しい命名規則を使用していること, so that テストが新しい API を正しく検証する

#### Acceptance Criteria

1. All test cases in `packages/cli/src/gen-orchestrator/testdata/` shall use the new `Gql` prefixed type names
2. The testdata shall NOT contain any usage of old type names (`DefineInterface`, `DefineScalar`, `Directive`, `GqlTypeDef`, `GqlFieldDef`)
3. Golden files shall be regenerated to reflect the updated testdata using new type names
4. All existing tests shall pass after the migration to new type names

### Requirement 5: ドキュメントとサンプルの更新

**Objective:** As a gqlkit ユーザー, I want ドキュメントとサンプルコードが新しい命名規則を反映していること, so that 新しい API の使い方を正しく学べる

#### Acceptance Criteria

1. The steering documents (`.kiro/steering/*.md`) shall use the new `Gql` prefixed type names in all examples and descriptions
2. The example projects (`examples/`) shall use the new `Gql` prefixed type names in their type definitions
3. The TSDoc comments in @gqlkit-ts/runtime shall include examples using the new type names
4. The CLAUDE.md shall reflect the updated type names in the TypeScript to GraphQL type mapping table and Runtime package exports section
5. All documentation shall NOT contain any references to old type names except in migration notes (if any)

