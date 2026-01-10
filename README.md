# gqlkit

gqlkit is a convention-driven code generator for GraphQL servers in TypeScript.

You define GraphQL types and resolver signatures in TypeScript.
Then `gqlkit gen` generates GraphQL schema AST and a resolver map from your codebase.

## Highlights

- **TypeScript-first** - Type-safe schema and resolvers in plain TypeScript, no decorators needed
- **Simple and minimal** - No DSL or complex generics; just types and functions; friendly for humans and AI
- **Convention over configuration** - Few rules, sensible defaults, works out of the box
- **Deterministic** - Same code always generates the same schema

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
// src/gqlkit/schema/task.ts
import { createGqlkitApis, type IDString, type NoArgs } from "@gqlkit-ts/runtime";

const { defineQuery, defineMutation } = createGqlkitApis();

export type Task = {
  id: IDString;
  title: string;
  completed: boolean;
};

const tasksData: Task[] = [];
let nextId = 1;

export const tasks = defineQuery<NoArgs, Task[]>(() => tasksData);

export type CreateTaskInput = {
  title: string;
};

export const createTask = defineMutation<{ input: CreateTaskInput }, Task>(
  (_root, { input }) => {
    const task: Task = {
      id: String(nextId++) as Task["id"],
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
  tasks_ {
    id
    title
    completed
  }
}
```

## Documentation

For detailed usage, features, and API reference, visit the documentation site:

**[https://gqlkit.izumin.dev](https://gqlkit.izumin.dev)**
