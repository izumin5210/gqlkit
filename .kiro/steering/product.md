# Product Overview

gqlkit is a convention-driven code generator for GraphQL servers in TypeScript. It transforms TypeScript type definitions and resolver signatures into GraphQL schema AST and resolver maps without decorators, configuration, or runtime schema mutation.

## Core Capabilities

- **Convention-driven schema generation**: TypeScript types become GraphQL types through predictable naming conventions
- **Deterministic output**: Same code always produces same schema AST and resolver maps
- **Static analysis only**: Pure TypeScript analysis without decorators or runtime metadata
- **Fail-fast validation**: Actionable errors for type mismatches, missing references, and convention violations
- **Documentation extraction**: TSDoc comments automatically become GraphQL schema descriptions with `@deprecated` support

## Target Use Cases

- Projects wanting GraphQL schema derived directly from TypeScript types
- Teams preferring convention over configuration for schema generation
- Developers seeking type-safe GraphQL without decorator ceremony
- Codebases requiring deterministic, reproducible build outputs

## Value Proposition

gqlkit provides a "kit" experience: consistent conventions paired with consistent diagnostics. By using the Define API via `createGqlkitApis<TContext>()`, it enables explicit, type-safe resolver definitions with custom context types while maintaining full type safety. The output is compatible with graphql-tools' `makeExecutableSchema`, integrating seamlessly with any GraphQL runtime.

---
_Focus on patterns and purpose, not exhaustive feature lists_
_Updated: 2025-01-01 - Documentation extraction capability_
