# Defining Types

gqlkit converts your TypeScript types to GraphQL schema types automatically.

## Object Types

Export a TypeScript type or interface:

```typescript
export type User = {
  id: string;
  name: string;
  email: string | null;
  posts: Post[];
};
```

This generates:

```graphql
type User {
  id: String!
  name: String!
  email: String
  posts: [Post!]!
}
```

## Nullability

Use union with `null` to make fields nullable:

```typescript
export type User = {
  email: string | null;  // nullable
  name: string;          // non-null
};
```

## Arrays

Arrays are automatically converted to GraphQL lists:

```typescript
export type User = {
  tags: string[];           // [String!]!
  posts: Post[] | null;     // [Post!]
};
```

## Input Types

Types with `Input` suffix are treated as input types:

```typescript
export type CreateUserInput = {
  name: string;
  email: string;
};
```

## Enums

String literal unions become enums:

```typescript
export type Status = "ACTIVE" | "INACTIVE" | "PENDING";
```

TypeScript enums are also supported:

```typescript
export enum Role {
  ADMIN = "ADMIN",
  USER = "USER",
}
```
