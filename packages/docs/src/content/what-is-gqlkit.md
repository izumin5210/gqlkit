# What is gqlkit?

gqlkit is a convention-driven code generator for GraphQL servers in TypeScript.

## Core Concept

Define GraphQL types and resolver signatures in TypeScript → `gqlkit gen` generates GraphQL schema AST and a resolver map from your codebase.

## Design Principles

- **Type-First**: Define types using plain TypeScript, no decorators needed
- **Fail fast with actionable errors**: Invalid resolver references, type mismatches, etc.
- **No runtime schema mutation**: Pure static analysis of TypeScript code
- **Deterministic**: Same code → same outputs, always
- **GraphQL-tools compatible**: Generated outputs work seamlessly with `makeExecutableSchema`

## How It Works

1. You write TypeScript types and resolvers in `src/gqlkit/schema/`
2. Run `gqlkit gen`
3. gqlkit scans your code, builds internal type graph, and validates resolver signatures
4. Outputs `typeDefs` (GraphQL AST) and `resolvers` map to `src/gqlkit/__generated__/`
