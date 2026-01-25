<div align="center">
  
# gqlkit

**Just types and functions** — write TypeScript, generate GraphQL.

[![NPM Version](https://img.shields.io/npm/v/%40gqlkit-ts%2Fcli)](https://www.npmjs.com/package/@gqlkit-ts/cli)
[![Socket Badge](https://badge.socket.dev/npm/package/@gqlkit-ts/cli)](https://badge.socket.dev/npm/package/@gqlkit-ts/cli)
[![GitHub License](https://img.shields.io/github/license/izumin5210/gqlkit)](./LICENSE)

</div>

## Highlights

- **Implement first** - Write types and resolvers, generate schema when ready. No edit-regenerate-implement loops.
- **Just types and functions** - Plain TypeScript with a thin API. No complex generics, no decorators.
- **Type-safe** - TypeScript types become GraphQL types. Resolver signatures checked at compile time.

## Getting started

### 1. Install dependencies

```bash
# Runtime dependencies
npm install @gqlkit-ts/runtime graphql @graphql-tools/schema

# Development dependency
npm install -D @gqlkit-ts/cli
```

### 2. Create types and resolvers

```ts
// src/gqlkit/gqlkit.ts
import { createGqlkitApis } from "@gqlkit-ts/runtime";
import { Context } from "./context.js";

export const { defineField, defineQuery, defineMutation } = createGqlkitApis<Context>();
```

```ts
// src/gqlkit/schema/task.ts
import type { IDString, NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery, defineMutation } from "../gqlkit.js";

export type Task = {
  id: IDString;
  title: string;
  completed: boolean;
};

const tasksData: Task[] = [];

// Query
export const tasks = defineQuery<NoArgs, Task[]>(() => tasksData);

// Mutation
export const createTask = defineMutation<{ input: { title: string } }, Task>(
  (_root, { input }) => {
    const task: Task = {
      id: crypto.randomUUID(),
      title: input.title,
      completed: false,
    };
    tasksData.push(task);
    return task;
  }
);
```

### 3. Generate schema and resolvers

```bash
gqlkit gen
```

This generates:
- `src/gqlkit/__generated__/typeDefs.ts` - GraphQL schema AST
- `src/gqlkit/__generated__/resolvers.ts` - Resolver map
- `src/gqlkit/__generated__/schema.graphql` - SDL file

### 4. Create the executable schema

```ts
// src/schema.ts
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./gqlkit/__generated__/typeDefs.js";
import { resolvers } from "./gqlkit/__generated__/resolvers.js";

export const schema = makeExecutableSchema({ typeDefs, resolvers });
```

### 5. Start a GraphQL server (e.g., Yoga)

```bash
npm install graphql-yoga
```

```ts
// src/server.ts
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema.js";

const yoga = createYoga({ schema });
const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Server running at http://localhost:4000/graphql");
});
```

Run the server and open http://localhost:4000/graphql to access GraphiQL:

```graphql
mutation {
  createTask(input: { title: "Learn gqlkit" }) {
    id
    title
    completed
  }
}

query {
  tasks {
    id
    title
    completed
  }
}
```

## Documentation

For detailed usage, features, and API reference, visit the documentation site:

**[https://gqlkit.izumin.dev](https://gqlkit.izumin.dev)**
