# Queries & Mutations

Define Query and Mutation fields using the `@gqlkit-ts/runtime` API.

## Setup

Create your API factory with your context type:

```typescript
import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = {
  userId: string;
  db: Database;
};

const { defineQuery, defineMutation, defineField } = createGqlkitApis<Context>();
```

## Query Resolvers

Use `defineQuery` to define Query fields. The export name becomes the GraphQL field name:

```typescript
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { User } from "./user";

const { defineQuery } = createGqlkitApis<Context>();

// Query.me
export const me = defineQuery<NoArgs, User | null>(
  (_root, _args, ctx) => {
    return ctx.db.findUser(ctx.userId);
  }
);

// Query.user(id: String!)
export const user = defineQuery<{ id: string }, User | null>(
  (_root, args, ctx) => {
    return ctx.db.findUser(args.id);
  }
);

// Query.users
export const users = defineQuery<NoArgs, User[]>(
  (_root, _args, ctx) => {
    return ctx.db.findAllUsers();
  }
);
```

Generates:

```graphql
type Query {
  me: User
  user(id: String!): User
  users: [User!]!
}
```

## Mutation Resolvers

Use `defineMutation` to define Mutation fields:

```typescript
import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { User, CreateUserInput } from "./user";

const { defineMutation } = createGqlkitApis<Context>();

// Mutation.createUser(input: CreateUserInput!)
export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  (_root, args, ctx) => {
    return ctx.db.createUser(args.input);
  }
);

// Mutation.deleteUser(id: String!)
export const deleteUser = defineMutation<{ id: string }, boolean>(
  (_root, args, ctx) => {
    return ctx.db.deleteUser(args.id);
  }
);
```

Generates:

```graphql
type Mutation {
  createUser(input: CreateUserInput!): User!
  deleteUser(id: String!): Boolean!
}
```

## Resolver Function Signature

Query and Mutation resolvers receive four arguments:

```typescript
(root, args, ctx, info) => ReturnType
```

| Argument | Description |
|----------|-------------|
| `root` | The root value (usually undefined) |
| `args` | The arguments passed to the field |
| `ctx` | The context object (typed via `createGqlkitApis<Context>()`) |
| `info` | GraphQL resolve info |

## NoArgs Type

Use the `NoArgs` type when a field has no arguments:

```typescript
import { type NoArgs } from "@gqlkit-ts/runtime";

export const me = defineQuery<NoArgs, User | null>(
  (_root, _args, ctx) => ctx.currentUser
);
```

## Arguments with Input Types

Use Input types for complex arguments:

```typescript
export type SearchUsersInput = {
  query: string;
  limit: number | null;
};

export const searchUsers = defineQuery<{ input: SearchUsersInput }, User[]>(
  (_root, args) => {
    return findUsers(args.input.query, args.input.limit ?? 10);
  }
);
```

## Inline Object Arguments

Arguments can use inline object literals. gqlkit automatically generates Input Object types:

```typescript
export const searchUsers = defineQuery<
  {
    /** Search filter */
    filter: {
      namePattern: string | null;
      status: UserStatus | null;
    };
  },
  User[]
>((_root, args) => []);
```

Generates:

```graphql
type Query {
  searchUsers(
    """Search filter"""
    filter: SearchUsersFilterInput!
  ): [User!]!
}

input SearchUsersFilterInput {
  namePattern: String
  status: UserStatus
}
```

See [Field Resolvers](./fields.md) for more details on inline object arguments.

## Attaching Directives

Add a third type parameter to attach directives to Query/Mutation fields:

```typescript
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import { type AuthDirective } from "./directives.js";
import type { User } from "./user.js";

const { defineQuery } = createGqlkitApis<Context>();

export const me = defineQuery<
  NoArgs,
  User,
  [AuthDirective<{ role: ["USER"] }>]
>((_root, _args, ctx) => ctx.currentUser);
```

Generates:

```graphql
type Query {
  me: User! @auth(role: [USER])
}
```

See [Directives](./directives.md) for more details on defining and using custom directives.
