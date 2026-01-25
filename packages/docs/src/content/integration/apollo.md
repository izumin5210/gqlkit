# Apollo Server

[Apollo Server](https://www.apollographql.com/docs/apollo-server/) is a popular GraphQL server with extensive features and ecosystem.

## Installation

```sh filename="npm"
npm install @apollo/server
```

```sh filename="pnpm"
pnpm add @apollo/server
```

```sh filename="yarn"
yarn add @apollo/server
```

## Prerequisites

Create an executable schema following the [Getting Started guide](../getting-started.md#create-graphql-schema).

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

If your resolvers use a context type, first [set up context and resolver factories](../getting-started.md#set-up-context-and-resolver-factories), then provide a context factory to your server:

```typescript
// src/server.ts
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { schema } from "./schema";
import type { Context } from "./gqlkit/context";

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
