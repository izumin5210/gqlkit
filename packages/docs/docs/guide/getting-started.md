# Getting Started

## Installation

::: code-group

```sh [npm]
npm install @gqlkit-ts/runtime @graphql-tools/schema graphql
npm install -D @gqlkit-ts/cli
```

```sh [pnpm]
pnpm add @gqlkit-ts/runtime @graphql-tools/schema graphql
pnpm add -D @gqlkit-ts/cli
```

```sh [yarn]
yarn add @gqlkit-ts/runtime @graphql-tools/schema graphql
yarn add -D @gqlkit-ts/cli
```

:::

## Project Structure

gqlkit expects your types and resolvers to be in `src/gqlkit/schema/`:

```
src/
└── gqlkit/
    └── schema/
        ├── user.ts      # User type and resolvers
        ├── post.ts      # Post type and resolvers
        └── query.ts     # Query resolvers
```

## Define Your First Type

Create a simple User type in `src/gqlkit/schema/user.ts`:

```typescript
export type User = {
  id: string;
  name: string;
  email: string | null;
};
```

## Define a Query

Create a query resolver in `src/gqlkit/schema/query.ts`:

```typescript
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { User } from "./user";

type Context = {
  currentUser: User | null;
};

const { defineQuery } = createGqlkitApis<Context>();

export const me = defineQuery<NoArgs, User | null>(
  (_root, _args, ctx) => ctx.currentUser
);
```

## Generate Schema

Run the generator:

::: code-group

```sh [npm]
npm exec gqlkit gen
```

```sh [pnpm]
pnpm gqlkit gen
```

```sh [yarn]
yarn gqlkit gen
```

:::

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
