---
title: Defining Queries and Mutations
description: Define Query and Mutation fields using the @gqlkit-ts/runtime API.
---

# Queries & Mutations

Define Query and Mutation fields using the `@gqlkit-ts/runtime` API.

> **Prerequisites**: This guide assumes you have completed the [basic setup](../getting-started.md#set-up-context-and-resolver-factories).

## Query Resolvers

Use `defineQuery` to define Query fields. The export name becomes the GraphQL field name:

```typescript
import { defineQuery } from "../gqlkit";
import type { NoArgs } from "@gqlkit-ts/runtime";
import type { User } from "./user";

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
import { defineMutation } from "../gqlkit";
import type { User, CreateUserInput } from "./user";

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

Inline string literal unions and external TypeScript enums in arguments are also automatically converted to GraphQL enum types. See [Inline Enums](./enums.md#inline-enums) for details.

See [Field Resolvers](./fields.md) for more details on inline object arguments.

## Inline Payload Types

Return types can use inline object literals. gqlkit automatically generates GraphQL Object types with the naming convention `{PascalCaseResolverName}Payload`:

```typescript
export const updateUser = defineMutation<
  { input: UpdateUserInput },
  { user: User; updatedAt: string }
>((_root, args, ctx) => ({
  user: ctx.db.updateUser(args.input),
  updatedAt: new Date().toISOString(),
}));
```

Generates:

```graphql
type Mutation {
  updateUser(input: UpdateUserInput!): UpdateUserPayload!
}

type UpdateUserPayload {
  user: User!
  updatedAt: String!
}
```

### Inline Union Payloads

Union types with inline object literals generate GraphQL Union types. Each union member must have a `__typename` property with a string literal type:

```typescript
export const updateUser = defineMutation<
  { input: UpdateUserInput },
  | { __typename: "UpdateUserSuccess"; user: User }
  | { __typename: "UpdateUserError"; message: string }
>((_root, args, ctx) => {
  const result = ctx.db.updateUser(args.input);
  if (result.ok) {
    return { __typename: "UpdateUserSuccess", user: result.user };
  }
  return { __typename: "UpdateUserError", message: result.error };
});
```

Generates:

```graphql
type Mutation {
  updateUser(input: UpdateUserInput!): UpdateUserPayload!
}

union UpdateUserPayload = UpdateUserError | UpdateUserSuccess

type UpdateUserSuccess {
  user: User!
}

type UpdateUserError {
  message: String!
}
```

The `__resolveType` function is automatically generated based on the `__typename` property. See [Abstract Type Resolution](./abstract-resolvers.md) for more details.

### Inline Enum Payloads

String literal unions in return types generate GraphQL Enum types:

```typescript
export const getStatus = defineQuery<NoArgs, "active" | "inactive" | "pending">(
  (_root, _args, ctx) => ctx.db.getStatus()
);
```

Generates:

```graphql
type Query {
  getStatus: GetStatusPayload!
}

enum GetStatusPayload {
  ACTIVE
  INACTIVE
  PENDING
}
```

### Nested Inline Types

Inline types can be nested within payload objects:

```typescript
export const createOrder = defineMutation<
  { input: CreateOrderInput },
  {
    order: {
      id: string;
      status: "pending" | "confirmed";
      items: { productId: string; quantity: number }[];
    };
  }
>(/* ... */);
```

Generates:

```graphql
type CreateOrderPayload {
  order: CreateOrderPayloadOrder!
}

type CreateOrderPayloadOrder {
  id: String!
  status: CreateOrderPayloadOrderStatus!
  items: [CreateOrderPayloadOrderItems!]!
}

enum CreateOrderPayloadOrderStatus {
  PENDING
  CONFIRMED
}

type CreateOrderPayloadOrderItems {
  productId: String!
  quantity: Float!
}
```

## Attaching Directives

Add a third type parameter to attach directives to Query/Mutation fields:

```typescript
import { defineQuery } from "../gqlkit";
import type { NoArgs } from "@gqlkit-ts/runtime";
import { type AuthDirective } from "./directives.js";
import type { User } from "./user.js";

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
