# Product Overview

gqlkit is a convention-driven code generator for GraphQL servers in TypeScript. It transforms TypeScript type definitions and resolver signatures into GraphQL schema AST and resolver maps without decorators, configuration, or runtime schema mutation.

## Core Capabilities

- **Convention-driven schema generation**: TypeScript types become GraphQL types through predictable naming conventions
- **Deterministic output**: Same code always produces same schema AST and resolver maps
- **Static analysis only**: Pure TypeScript analysis without decorators or runtime metadata
- **Fail-fast validation**: Actionable errors for type mismatches, missing references, and convention violations
- **Documentation extraction**: TSDoc comments automatically become GraphQL schema descriptions with `@deprecated` support
- **Branded scalar types**: Type-safe distinction between GraphQL scalar types (ID, Int, Float) via branded TypeScript types from `@gqlkit-ts/runtime`
- **Custom scalar definition**: `DefineScalar<Name, Base>` utility type for inline custom scalar types with embedded metadata, or config-based mappings via `gqlkit.config.ts`
- **Comprehensive type support**: Enum, Union, Input Object, Interface, and `@oneOf` input object types from TypeScript conventions
- **Interface type definition**: `DefineInterface` utility type for GraphQL interfaces with inheritance support via `implements`
- **Default values**: Input field and argument default values via `GqlFieldDef<T, { defaultValue: ... }>`
- **Multiple output formats**: Generate schema AST (DocumentNode) or SDL string, with optional schema pruning

## Target Use Cases

- Projects wanting GraphQL schema derived directly from TypeScript types
- Teams preferring convention over configuration for schema generation
- Developers seeking type-safe GraphQL without decorator ceremony
- Codebases requiring deterministic, reproducible build outputs

## Value Proposition

gqlkit provides a "kit" experience: consistent conventions paired with consistent diagnostics. By using the Define API via `createGqlkitApis<TContext>()`, it enables explicit, type-safe resolver definitions with custom context types while maintaining full type safety. The output is compatible with graphql-tools' `makeExecutableSchema`, integrating seamlessly with any GraphQL runtime.

---
_Focus on patterns and purpose, not exhaustive feature lists_
_Updated: 2026-01-09 - Added Interface type support (DefineInterface, implements) and default value support for input fields_
