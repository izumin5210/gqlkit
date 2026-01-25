# Product Overview

Just types and functions — write TypeScript, generate GraphQL.

gqlkit is a code generator for GraphQL servers in TypeScript. Write types and resolvers first, then generate schema when ready.

## Design Principles

- **Implement first**: Write types and resolvers, generate schema when ready. No edit-regenerate-implement loops.
- **Just types and functions**: Plain TypeScript with a thin API. No complex generics, no decorators.
- **Type-safe**: TypeScript types become GraphQL types. Resolver signatures checked at compile time.

## Core Capabilities

- **Convention-driven schema generation**: TypeScript types become GraphQL types through predictable naming conventions
- **Deterministic output**: Same code always produces same schema AST and resolver maps
- **Static analysis only**: Pure TypeScript analysis without decorators or runtime metadata
- **Fail-fast validation**: Actionable errors for type mismatches, missing references, and convention violations
- **Documentation extraction**: TSDoc comments automatically become GraphQL schema descriptions with `@deprecated` support
- **Branded scalar types**: Type-safe distinction between GraphQL scalar types (ID, Int, Float) via branded TypeScript types from `@gqlkit-ts/runtime`
- **Custom scalar definition**: `GqlScalar<Name, Base>` utility type for inline custom scalar types with embedded metadata, or config-based mappings via `gqlkit.config.ts`
- **Comprehensive type support**: Enum, Union, Input Object, Interface, and `@oneOf` input object types from TypeScript conventions
- **Interface type definition**: `GqlInterface` utility type for GraphQL interfaces with inheritance support via `implements`
- **Abstract type resolution**: `defineResolveType` and `defineIsTypeOf` for runtime type resolution of unions and interfaces
- **Default values**: Input field and argument default values via `GqlField<T, { defaultValue: ... }>`
- **Auto-type generation**: Inline types (objects, unions, string literal unions) in fields and resolver arguments are automatically converted to named GraphQL types with predictable naming conventions
- **Multiple output formats**: Generate schema AST (DocumentNode) or SDL string, with optional schema pruning

## Target Use Cases

- Teams tired of schema-first edit-regenerate-implement loops
- Developers wanting implementation-first workflow where schema follows code
- Projects seeking type-safe GraphQL without complex DSLs or decorator ceremony
- Codebases requiring deterministic, reproducible build outputs

## Value Proposition

gqlkit inverts the typical schema-first workflow: write implementation first, generate schema later. This eliminates the friction of constantly switching between schema definition and code generation. With plain TypeScript types and a thin API layer, there's minimal learning curve—just familiar types and functions. The output is compatible with graphql-tools' `makeExecutableSchema`, integrating seamlessly with any GraphQL runtime.

---
_Focus on patterns and purpose, not exhaustive feature lists_
_Updated: 2026-01-25 - Revised messaging: "Just types and functions — write TypeScript, generate GraphQL"_
