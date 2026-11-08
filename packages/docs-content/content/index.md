# gqlkit

**Just types and functions — write TypeScript, generate GraphQL.**

[Get Started](/getting-started) | [View on GitHub](https://github.com/izumin5210/gqlkit)

## How it works

1. Write TypeScript types in `src/gqlkit/schema/` → become GraphQL types
2. Write resolver functions using `defineQuery`, `defineMutation`, `defineField` → become GraphQL resolvers
3. Run `gqlkit gen` → outputs `typeDefs` and `resolvers` to `src/gqlkit/__generated__/`

## Features

### Implement First

Write types and resolvers, generate schema when ready. No edit-regenerate-implement loops.

### Just Types and Functions

Plain TypeScript with a thin API. No complex generics, no decorators.

### Type-Safe

TypeScript types become GraphQL types. Resolver signatures checked at compile time.
