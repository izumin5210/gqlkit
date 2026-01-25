# @gqlkit-ts/runtime

Runtime utilities for [gqlkit](https://gqlkit.izumin.dev) — type-safe resolver definitions with a thin API.

```ts
// src/gqlkit/gqlkit.ts
import { createGqlkitApis, type IDString } from "@gqlkit-ts/runtime";
import {} from "./context.js";

export const { defineQuery, defineMutation, defineField } = createGqlkitApis<Context>();
```

```ts
// src/gqlkit/schema/tasks.ts
import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineQuery, defineMutation } from "../gqlkit.js";

// Query
export const tasks = defineQuery<NoArgs, Task[]>(() => fetchTasks());

// Mutation
export const createTask = defineMutation<{ input: CreateTaskInput }, Task>(
  (_, { input }) => createNewTask(input)
);

// Field resolver
export const taskAuthor = defineField<Task, NoArgs, User>(
  (task) => fetchUser(task.authorId)
);
```

For full documentation, visit [gqlkit.izumin.dev](https://gqlkit.izumin.dev).
