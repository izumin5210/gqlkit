# Union Types

TypeScript union types of object types are converted to GraphQL union types.

## Basic Usage

```typescript
import type { Post } from "./Post";
import type { Comment } from "./Comment";

/**
 * Content that can be searched
 */
export type SearchResult = Post | Comment;
```

Generates:

```graphql
"""Content that can be searched"""
union SearchResult = Comment | Post
```

## Using Unions in Resolvers

```typescript
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { SearchResult } from "./types";

const { defineQuery } = createGqlkitApis<Context>();

export const search = defineQuery<{ query: string }, SearchResult[]>(
  (_root, args, ctx) => {
    return ctx.db.search(args.query);
  }
);
```

Generates:

```graphql
type Query {
  search(query: String!): [SearchResult!]!
}
```

## Union vs Enum

- Use **Union** when each member is a distinct object type with different fields
- Use **Enum** when you need a set of string constants

```typescript
// Union: Different object types
export type SearchResult = Post | Comment | User;

// Enum: String constants
export type Status = "ACTIVE" | "INACTIVE" | "PENDING";
```

## Union vs Interface

- Use **Union** when types share no common fields
- Use **Interface** when types share common fields that should be queryable

```typescript
// Union: No common structure required
export type SearchResult = Post | Comment;

// Interface: Common fields enforced
export type Node = GqlInterface<{
  id: IDString;
}>;
```

See [Interfaces](./interfaces.md) for more details on interface types.

## Runtime Type Resolution

When GraphQL executes a query that returns a union type, it needs to determine the concrete type at runtime. Use `defineResolveType` to handle this:

```typescript
const { defineResolveType } = createGqlkitApis<Context>();

export const searchResultResolveType = defineResolveType<SearchResult>(
  (value) => {
    if ("name" in value) return "User";
    return "Post";
  }
);
```

See [Abstract Type Resolution](./abstract-resolvers.md) for complete documentation.
