# Defining Resolvers

Use the `createGqlkitApis` factory from `@gqlkit-ts/runtime` to define type-safe resolvers.

## Setup

First, create your API factory with your context type:

```typescript
import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = {
  userId: string;
  db: Database;
};

export const { defineQuery, defineMutation, defineField } =
  createGqlkitApis<Context>();
```

## Query Resolvers

```typescript
import { defineQuery } from "./apis";
import type { User } from "./user";

export const user = defineQuery<{ id: string }, User | null>(
  (root, args, ctx) => {
    return ctx.db.findUser(args.id);
  }
);

export const users = defineQuery<{}, User[]>(
  (root, args, ctx) => {
    return ctx.db.findAllUsers();
  }
);
```

## Mutation Resolvers

```typescript
import { defineMutation } from "./apis";
import type { User, CreateUserInput } from "./user";

export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  (root, args, ctx) => {
    return ctx.db.createUser(args.input);
  }
);
```

## Field Resolvers

```typescript
import { defineField } from "./apis";
import type { User } from "./user";
import type { Post } from "./post";

export const User_posts = defineField<User, {}, Post[]>(
  (parent, args, ctx) => {
    return ctx.db.findPostsByUserId(parent.id);
  }
);
```

The export name `User_posts` indicates this is a field resolver for the `posts` field on the `User` type.
