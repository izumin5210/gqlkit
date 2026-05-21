---
name: gqlkit-guide
description: Use when the user asks about "gqlkit", "gqlkit usage", "gqlkit schema definition", "gqlkit configuration", "gqlkit resolvers", "GraphQL code generation with gqlkit", or needs guidance on gqlkit conventions, type definitions, or integration with GraphQL servers or ORMs.
---

# gqlkit Guide

gqlkit generates GraphQL schema and resolver maps from TypeScript types and functions.

## How it works

1. Write TypeScript types in `src/gqlkit/schema/` → become GraphQL types
2. Write resolver functions using `defineQuery`, `defineMutation`, `defineField` → become GraphQL resolvers
3. Run `gqlkit gen` → outputs `typeDefs` and `resolvers` to `src/gqlkit/__generated__/`

## Design principles

- **Implement first**: Write types and resolvers, generate schema when ready. No edit-regenerate-implement loops.
- **Just types and functions**: Plain TypeScript with a thin API. No decorators, no complex generics.
- **Type-safe**: TypeScript types become GraphQL types. Resolver signatures checked at compile time.

## How to Use This Skill

Read [references/index.md](references/index.md) first. It contains the complete documentation index with all available topics.

Navigate to specific documentation files based on user needs as indicated in the index.
