# graphql-yoga

[graphql-yoga](https://the-guild.dev/graphql/yoga-server) is a batteries-included GraphQL server that works in any JavaScript runtime.

## Installation

```sh filename="npm"
npm install graphql-yoga
```

```sh filename="pnpm"
pnpm add graphql-yoga
```

```sh filename="yarn"
yarn add graphql-yoga
```

## Prerequisites

Create an executable schema following the [Getting Started guide](../getting-started.md#create-graphql-schema).

## Basic Server

```typescript
// src/server.ts
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema";

const yoga = createYoga({ schema });
const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Server is running on http://localhost:4000/graphql");
});
```

## With Context

If your resolvers use a context type, first [set up context and resolver factories](../getting-started.md#set-up-context-and-resolver-factories), then provide a context factory to your server:

```typescript
// src/server.ts
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema";
import type { Context } from "./gqlkit/context";

const yoga = createYoga<{}, Context>({
  schema,
  context: async ({ request }) => {
    const user = await getUserFromRequest(request);
    return {
      currentUser: user,
      db: database,
    };
  },
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Server is running on http://localhost:4000/graphql");
});
```

## Further Reading

- [graphql-yoga Documentation](https://the-guild.dev/graphql/yoga-server/docs)
- [Envelop Plugins](https://the-guild.dev/graphql/envelop/plugins)
