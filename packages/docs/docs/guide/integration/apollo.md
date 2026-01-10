# Apollo Server

[Apollo Server](https://www.apollographql.com/docs/apollo-server/) is a popular GraphQL server with extensive features and ecosystem.

## Installation

::: code-group

```sh [npm]
npm install @apollo/server
```

```sh [pnpm]
pnpm add @apollo/server
```

```sh [yarn]
yarn add @apollo/server
```

:::

## Creating the Schema

First, create an executable schema using `makeExecutableSchema`:

```typescript
// src/schema.ts
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./gqlkit/__generated__/schema";
import { resolvers } from "./gqlkit/__generated__/resolvers";

export const schema = makeExecutableSchema({ typeDefs, resolvers });
```

## Basic Server

Using the standalone server:

```typescript
// src/server.ts
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { schema } from "./schema";

const server = new ApolloServer({ schema });

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
});

console.log(`Server is running on ${url}`);
```

## With Context

If your resolvers use a context type, provide a context factory:

```typescript
// src/gqlkit/schema/query.ts
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { User } from "./user";

export type Context = {
  currentUser: User | null;
  db: Database;
};

const { defineQuery } = createGqlkitApis<Context>();

export const me = defineQuery<NoArgs, User | null>(
  (_root, _args, ctx) => ctx.currentUser
);
```

```typescript
// src/server.ts
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { schema } from "./schema";
import type { Context } from "./gqlkit/schema/query";

const server = new ApolloServer<Context>({ schema });

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req }) => {
    const user = await getUserFromRequest(req);
    return {
      currentUser: user,
      db: database,
    };
  },
});

console.log(`Server is running on ${url}`);
```

## Further Reading

- [Apollo Server Documentation](https://www.apollographql.com/docs/apollo-server/)
- [Apollo Server Plugins](https://www.apollographql.com/docs/apollo-server/builtin-plugins)
