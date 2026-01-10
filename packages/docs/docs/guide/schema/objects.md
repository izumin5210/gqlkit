# Object Types

Plain TypeScript type exports become GraphQL Object types.

## Basic Usage

Export a TypeScript type or interface:

```typescript
// src/gqlkit/schema/user.ts
import { createGqlkitApis, type IDString, type Int, type NoArgs } from "@gqlkit-ts/runtime";

type Context = { currentUserId: string };

const { defineQuery, defineField } = createGqlkitApis<Context>();

/**
 * A user in the system
 */
export type User = {
  /** Unique identifier */
  id: IDString;
  /** Display name */
  name: string;
  /** Age in years */
  age: Int;
  /** Email address (null if not verified) */
  email: string | null;
};

export const me = defineQuery<NoArgs, User | null>((_root, _args, ctx) => {
  return findUserById(ctx.currentUserId);
});

/** Get user's profile URL */
export const profileUrl = defineField<User, NoArgs, string>((parent) => {
  return `https://example.com/users/${parent.id}`;
});
```

## Nullability

Use union with `null` to make fields nullable:

```typescript
export type User = {
  email: string | null;  // nullable
  name: string;          // non-null
};
```

Generates:

```graphql
type User {
  email: String
  name: String!
}
```

## Arrays

Arrays are automatically converted to GraphQL lists:

```typescript
export type User = {
  tags: string[];           // [String!]!
  posts: Post[] | null;     // [Post!]
};
```

## Inline Objects

Object type fields can use inline object literals for nested structures. gqlkit automatically generates Object types with the naming convention `{ParentTypeName}{PascalCaseFieldName}`:

```typescript
export type User = {
  id: string;
  name: string;
  /** User's profile information */
  profile: {
    /** User's biography */
    bio: string;
    age: number;
  };
};
```

Generates:

```graphql
type User {
  id: String!
  name: String!
  """User's profile information"""
  profile: UserProfile!
}

type UserProfile {
  """User's biography"""
  bio: String!
  age: Float!
}
```

Nested inline objects generate types with concatenated names (e.g., `User.profile.address` → `UserProfileAddress`).

## Implementing Interfaces

Use `GqlObject` with the `implements` option to declare that a type implements interfaces:

```typescript
import { type GqlObject, type IDString } from "@gqlkit-ts/runtime";
import type { Node, Timestamped } from "./node.js";
import type { DateTime } from "./scalars.js";

/**
 * A user in the system.
 */
export type User = GqlObject<
  {
    id: IDString;
    name: string;
    email: string | null;
    createdAt: DateTime;
  },
  { implements: [Node, Timestamped] }
>;
```

Generates:

```graphql
"""A user in the system."""
type User implements Node & Timestamped {
  id: ID!
  name: String!
  email: String
  createdAt: DateTime!
}
```

You can combine `implements` with `directives`:

```typescript
export type Post = GqlObject<
  {
    id: IDString;
    title: string;
    createdAt: DateTime;
  },
  {
    implements: [Node, Timestamped],
    directives: [CacheDirective<{ maxAge: 60 }>]
  }
>;
```

See [Interfaces](./interfaces.md) for more details on defining interface types.
