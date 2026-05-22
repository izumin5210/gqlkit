---
title: What is gqlkit?
description: Just types and functions — write TypeScript, generate GraphQL.
---

# What is gqlkit?

Just types and functions — write TypeScript, generate GraphQL.

## Core Concept

Write types and resolvers in TypeScript → run `gqlkit gen` → get GraphQL schema AST and resolver map.

## Design Principles

- **Implement first**: Write types and resolvers, generate schema when ready. No edit-regenerate-implement loops.
- **Just types and functions**: Plain TypeScript with a thin API. No complex generics, no decorators.
- **Type-safe**: TypeScript types become GraphQL types. Resolver signatures checked at compile time.
- **Fail fast with actionable errors**: Invalid resolver references, type mismatches, and convention violations.
- **GraphQL-tools compatible**: Generated outputs work seamlessly with `makeExecutableSchema`.

## How It Works

1. Write TypeScript types and resolvers in `src/gqlkit/schema/`
2. Run `gqlkit gen`
3. gqlkit scans your code, builds internal type graph, and validates resolver signatures
4. Outputs `typeDefs` (GraphQL AST) and `resolvers` map to `src/gqlkit/__generated__/`
