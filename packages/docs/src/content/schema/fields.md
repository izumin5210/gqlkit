---
title: Defining Field Resolvers
description: Add computed fields to object types using defineField.
---

# Field Resolvers

Add computed fields to object types using `defineField`. Define them alongside the type.

GraphQL field names are derived from the exported variable name:

- Default: the full export name is used as-is.
- If the export name contains `$`, gqlkit uses the substring after the last `$`.
- If the export name ends with `$`, gqlkit reports an error.

## Basic Usage

```typescript
// src/gqlkit/schema/user.ts
import { defineField } from "../gqlkit";
import type { IDString, NoArgs } from "@gqlkit-ts/runtime";
import type { Post } from "./post.js";

export type User = {
  id: IDString;
  name: string;
};

/** Get posts authored by this user */
export const posts = defineField<User, NoArgs, Post[]>(
  (parent) => findPostsByAuthor(parent.id)
);

/** Get user's post count */
export const postCount = defineField<User, NoArgs, number>(
  (parent) => countPostsByAuthor(parent.id)
);
```

Generates:

```graphql
type User {
  id: ID!
  name: String!
  """Get posts authored by this user"""
  posts: [Post!]!
  """Get user's post count"""
  postCount: Float!
}
```

Example with `$` delimiter:

```typescript
// GraphQL field name: posts
export const User$posts = defineField<User, NoArgs, Post[]>(
  (parent) => findPostsByAuthor(parent.id)
);
```

## Resolver Function Signature

Field resolvers receive four arguments:

```typescript
(parent, args, ctx, info) => ReturnType
```

| Argument | Description |
|----------|-------------|
| `parent` | The parent object (typed via the first type parameter) |
| `args` | The arguments passed to the field |
| `ctx` | The context object (typed via `gqlkit.ts`) |
| `info` | GraphQL resolve info |

## Type Parameters

`defineField<TParent, TArgs, TResult>`:

| Parameter | Description |
|-----------|-------------|
| `TParent` | The parent object type this field is defined on |
| `TArgs` | The arguments type (use `NoArgs` if no arguments) |
| `TResult` | The return type of the field |

## Fields with Arguments

```typescript
export const posts = defineField<
  User,
  { limit: number; offset: number },
  Post[]
>((parent, args) => {
  return findPostsByAuthor(parent.id, args.limit, args.offset);
});
```

Generates:

```graphql
type User {
  posts(limit: Float!, offset: Float!): [Post!]!
}
```

## Inline Object Arguments

Field resolver arguments can use inline object literals. gqlkit automatically generates Input Object types with the naming convention `{ParentTypeName}{PascalCaseFieldName}{PascalCaseArgName}Input`:

```typescript
import { defineField } from "../gqlkit";

export const posts = defineField<
  User,
  {
    /** Filter options */
    filter: {
      titlePattern: string | null;
      status: PostStatus | null;
    } | null;
  },
  Post[]
>((parent, args) => []);
```

Generates:

```graphql
type User {
  posts(
    """Filter options"""
    filter: UserPostsFilterInput
  ): [Post!]!
}

input UserPostsFilterInput {
  titlePattern: String
  status: PostStatus
}
```

Inline string literal unions and external TypeScript enums in arguments are also automatically converted to GraphQL enum types. See [Inline Enums](./enums.md#inline-enums) for details.

## Inline Payload Types

Field resolver return types can use inline object literals. gqlkit automatically generates GraphQL Object types with the naming convention `{ParentTypeName}{PascalCaseFieldName}Payload`:

```typescript
export const statistics = defineField<
  User,
  NoArgs,
  { postCount: number; followerCount: number; isActive: boolean }
>((parent, _args, ctx) => ctx.db.getUserStatistics(parent.id));
```

Generates:

```graphql
type User {
  statistics: UserStatisticsPayload!
}

type UserStatisticsPayload {
  postCount: Float!
  followerCount: Float!
  isActive: Boolean!
}
```

### Inline Union Payloads

Union types with inline object literals generate GraphQL Union types. Each union member must have a `__typename` property:

```typescript
export const verification = defineField<
  User,
  NoArgs,
  | { __typename: "Verified"; verifiedAt: string }
  | { __typename: "Unverified"; reason: string }
>((parent) => parent.verification);
```

Generates:

```graphql
type User {
  verification: UserVerificationPayload!
}

union UserVerificationPayload = Unverified | Verified

type Verified {
  verifiedAt: String!
}

type Unverified {
  reason: String!
}
```

See [Queries & Mutations](./queries-mutations.md#inline-payload-types) for more details on inline payload types.

## Default Values in Arguments

Default values in Input Objects are applied to resolver arguments:

```typescript
import { defineQuery } from "../gqlkit";
import type { GqlField, Int } from "@gqlkit-ts/runtime";

export type PaginationInput = {
  limit: GqlField<Int, { defaultValue: 10 }>;
  offset: GqlField<Int, { defaultValue: 0 }>;
};

export type User = {
  id: string;
  name: string;
};

export const users = defineQuery<PaginationInput, User[]>(() => []);
```

Generates:

```graphql
type Query {
  users(limit: Int! = 10, offset: Int! = 0): [User!]!
}
```

## Interface Field Resolvers

Add computed fields to interface types using `defineField`:

```typescript
import { defineField } from "../gqlkit";
import type { NoArgs } from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

/** Get the typename of a Node */
export const __typename = defineField<Node, NoArgs, string>(
  (parent) => parent.constructor.name
);
```

## Attaching Directives

Add a fourth type parameter to attach directives to field resolvers:

```typescript
import { defineField } from "../gqlkit";
import type { NoArgs } from "@gqlkit-ts/runtime";
import { type AuthDirective } from "./directives.js";

export const email = defineField<
  User,
  NoArgs,
  string,
  [AuthDirective<{ role: ["ADMIN"] }>]
>((parent) => parent.email);
```

See [Directives](./directives.md) for more details on defining and using custom directives.
