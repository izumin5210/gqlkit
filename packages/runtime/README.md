# @gqlkit-ts/runtime

Runtime utilities for [gqlkit](https://gqlkit.izumin.dev) — type-safe resolver definitions with a thin API.

```ts
import { createGqlkitApis, type IDString, type NoArgs } from "@gqlkit-ts/runtime";

const { defineQuery, defineMutation, defineField } = createGqlkitApis();

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
