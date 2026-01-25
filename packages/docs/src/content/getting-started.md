---
title: Getting Started
description: Install gqlkit and create your first GraphQL schema from TypeScript.
---

# Getting Started

## Installation

```sh filename="npm"
npm install @gqlkit-ts/runtime @graphql-tools/schema graphql
npm install -D @gqlkit-ts/cli
```

```sh filename="pnpm"
pnpm add @gqlkit-ts/runtime @graphql-tools/schema graphql
pnpm add -D @gqlkit-ts/cli
```

```sh filename="yarn"
yarn add @gqlkit-ts/runtime @graphql-tools/schema graphql
yarn add -D @gqlkit-ts/cli
```

> [!TIP]
>
> If you use AI coding assistants like Claude Code or Codex, run `gqlkit docs` to set up gqlkit skills. See [Coding Assistants](./coding-assistants) for details.

## Project Structure

gqlkit expects your types and resolvers to be in `src/gqlkit/schema/`:

```
src/
└── gqlkit/
    ├── context.ts       # Context type definition
    ├── gqlkit.ts        # Resolver factories
    └── schema/
        ├── user.ts      # User type and resolvers
        ├── post.ts      # Post type and resolvers
        └── query.ts     # Query resolvers
```

## Set Up Context and Resolver Factories

Create `src/gqlkit/context.ts` to define your context type:

```typescript
export type Context = {
  currentUser: { id: string; name: string; email: string | null } | null;
};
```

Create `src/gqlkit/gqlkit.ts` to export resolver factories:

```typescript
import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { Context } from "./context";

export const { defineQuery, defineMutation, defineField } =
  createGqlkitApis<Context>();
```

## Define Your First Type and Query

Create a simple User type and query in `src/gqlkit/schema/user.ts`:

```typescript
import { defineQuery } from "../gqlkit";
import type { NoArgs } from "@gqlkit-ts/runtime";

export type User = {
  id: string;
  name: string;
  email: string | null;
};

// NoArgs indicates this query takes no arguments
export const me = defineQuery<NoArgs, User | null>(
  (_root, _args, ctx) => ctx.currentUser
);
```

## Generate Schema

Run the generator:

```sh filename="npm"
npm exec gqlkit gen
```

```sh filename="pnpm"
pnpm gqlkit gen
```

```sh filename="yarn"
yarn gqlkit gen
```

This will create files in `src/gqlkit/__generated__/`:
- `schema.ts` - GraphQL schema AST (DocumentNode)
- `resolvers.ts` - Resolver map

## Create GraphQL Schema

Use `@graphql-tools/schema` to combine the generated outputs into an executable schema:

```typescript
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./gqlkit/__generated__/schema";
import { resolvers } from "./gqlkit/__generated__/resolvers";

export const schema = makeExecutableSchema({ typeDefs, resolvers });
```

## Next Steps

- [HTTP Server Integration](./integration/yoga) - Connect your schema to graphql-yoga, Apollo Server, or other HTTP servers
- [Object Types](./schema/objects) - Learn more about defining types
- [Queries & Mutations](./schema/queries-mutations) - Advanced resolver patterns
