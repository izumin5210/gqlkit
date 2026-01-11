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
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema";
import type { Context } from "./gqlkit/schema/query";

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
