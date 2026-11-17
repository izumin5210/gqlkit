---
title: Adding Documentation to Schema
description: gqlkit extracts TSDoc/JSDoc comments and converts them to GraphQL descriptions.
---

# Documentation

gqlkit extracts TSDoc/JSDoc comments and converts them to GraphQL descriptions.

## Type Descriptions

Add descriptions to types using TSDoc/JSDoc comments:

```typescript
/**
 * A user in the system
 */
export type User = {
  /** Unique identifier */
  id: IDString;
  /** Display name */
  name: string;
};
```

Generates:

```graphql
"""
A user in the system

Defined in: src/gqlkit/schema/user.ts
"""
type User {
  """Unique identifier"""
  id: ID!
  """Display name"""
  name: String!
}
```

## Field Descriptions

Add descriptions to individual fields:

```typescript
export type User = {
  /** Unique identifier for the user */
  id: IDString;

  /**
   * The user's display name.
   * This is shown in the UI and can be changed by the user.
   */
  name: string;

  /** Email address (null if not verified) */
  email: string | null;
};
```

## Resolver Descriptions

Add descriptions to Query, Mutation, and Field resolvers:

```typescript
/** Get the currently authenticated user */
export const me = defineQuery<NoArgs, User | null>(
  (_root, _args, ctx) => ctx.currentUser
);

/** Create a new user account */
export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  (_root, args, ctx) => ctx.db.createUser(args.input)
);

/** Get user's profile URL */
export const profileUrl = defineField<User, NoArgs, string>(
  (parent) => `https://example.com/users/${parent.id}`
);
```

## @deprecated Directive

Mark fields and enum values as deprecated using the `@deprecated` JSDoc tag:

### Deprecating Fields

```typescript
export type User = {
  id: IDString;
  name: string;
  /**
   * Legacy username
   * @deprecated Use `name` field instead
   */
  username: string | null;
};
```

Generates:

```graphql
type User {
  id: ID!
  name: String!
  """Legacy username"""
  username: String @deprecated(reason: "Use `name` field instead")
}
```

### Deprecating Enum Values

```typescript
export enum UserStatus {
  Active = "ACTIVE",
  /**
   * @deprecated Use `Inactive` instead
   */
  Pending = "PENDING",
  Inactive = "INACTIVE",
}
```

Generates:

```graphql
enum UserStatus {
  ACTIVE
  PENDING @deprecated(reason: "Use `Inactive` instead")
  INACTIVE
}
```

### Deprecating Resolvers

```typescript
/**
 * Get user by username
 * @deprecated Use `user(id: ID!)` instead
 */
export const userByUsername = defineQuery<{ username: string }, User | null>(
  (_root, args, ctx) => ctx.db.findUserByUsername(args.username)
);
```

### Deprecating Types

GraphQL cannot mark a type itself as deprecated. When a type has the `@deprecated` tag, gqlkit adds the deprecation to the type's description and marks its fields (including those added with `defineField`) or enum values as deprecated. Members with their own `@deprecated` tag keep their own reason.

```typescript
/**
 * @deprecated Use `Account` instead
 */
export type User = {
  id: IDString;
  /**
   * @deprecated Use `displayName` instead
   */
  username: string;
};
```

Generates:

```graphql
"""Deprecated: Use `Account` instead"""
type User {
  id: ID! @deprecated(reason: "Use `Account` instead")
  username: String! @deprecated(reason: "Use `displayName` instead")
}
```

GraphQL does not allow deprecating required input fields, so on a deprecated input type only nullable fields and fields with a default value are marked. Union types get the description only.

## Multi-line Descriptions

Multi-line comments are preserved:

```typescript
/**
 * Represents a blog post.
 *
 * Posts can be in draft or published state.
 * Only published posts are visible to other users.
 */
export type Post = {
  id: IDString;
  title: string;
  content: string;
};
```

Generates:

```graphql
"""
Represents a blog post.

Posts can be in draft or published state.
Only published posts are visible to other users.

Defined in: src/gqlkit/schema/post.ts
"""
type Post {
  id: ID!
  title: String!
  content: String!
}
```
