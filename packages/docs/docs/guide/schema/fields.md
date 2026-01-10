# Field Resolvers

Add computed fields to object types using `defineField`. Define them alongside the type.

## Basic Usage

```typescript
// src/gqlkit/schema/user.ts
import { createGqlkitApis, type IDString, type NoArgs } from "@gqlkit-ts/runtime";
import type { Post } from "./post.js";

const { defineField } = createGqlkitApis<Context>();

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

## Resolver Function Signature

Field resolvers receive four arguments:

```typescript
(parent, args, ctx, info) => ReturnType
```

| Argument | Description |
|----------|-------------|
| `parent` | The parent object (typed via the first type parameter) |
| `args` | The arguments passed to the field |
| `ctx` | The context object (typed via `createGqlkitApis<Context>()`) |
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
import { createGqlkitApis, type GqlField } from "@gqlkit-ts/runtime";

const { defineQuery, defineField } = createGqlkitApis<Context>();

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

## Default Values in Arguments

Default values in Input Objects are applied to resolver arguments:

```typescript
import { createGqlkitApis, type GqlField, type Int } from "@gqlkit-ts/runtime";

const { defineQuery } = createGqlkitApis();

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
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

const { defineField } = createGqlkitApis<Context>();

/** Get the typename of a Node */
export const __typename = defineField<Node, NoArgs, string>(
  (parent) => parent.constructor.name
);
```

## Attaching Directives

Add a fourth type parameter to attach directives to field resolvers:

```typescript
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import { type AuthDirective } from "./directives.js";

const { defineField } = createGqlkitApis<Context>();

export const email = defineField<
  User,
  NoArgs,
  string,
  [AuthDirective<{ role: ["ADMIN"] }>]
>((parent) => parent.email);
```

See [Directives](./directives.md) for more details on defining and using custom directives.
