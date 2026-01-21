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
import { defineQuery } from "../gqlkit";
import type { SearchResult } from "./types";

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

## Inline Unions

When a field type is an inline union of object types, gqlkit automatically generates a GraphQL Union type. The generated type name follows the convention `{ParentTypeName}{PascalCaseFieldName}`:

```typescript
import type { User } from "./User";
import type { Post } from "./Post";

export type SearchResult = {
  id: string;
  /**
   * The matched item - either a User or a Post
   */
  item: User | Post;
};
```

Generates:

```graphql
type SearchResult {
  id: String!
  """The matched item - either a User or a Post"""
  item: SearchResultItem!
}

union SearchResultItem = Post | User
```

### Nullable Inline Unions

Inline unions can be nullable:

```typescript
export type Container = {
  id: string;
  result: User | Post | null;
};
```

Generates:

```graphql
type Container {
  id: String!
  result: ContainerResult
}

union ContainerResult = Post | User
```

### Known Type References

When union members are exported types in the schema directory (`knownTypeNames`), they are preserved as references. Unknown inline object types are automatically generated:

```typescript
import type { User } from "./User"; // known type

export type Activity = {
  actor: User | { id: string; type: string }; // User is referenced, anonymous object is generated
};
```

Generates:

```graphql
type Activity {
  actor: ActivityActor!
}

union ActivityActor = ActivityActorAnonymous | User

type ActivityActorAnonymous {
  id: String!
  type: String!
}
```

### Validation

Inline unions in output context must contain only object types. The following are not allowed:

- Primitive types (string, number, boolean)
- Enum types
- Scalar types

```typescript
// These will produce errors:
export type Invalid = {
  value: string | number;        // Error: primitives not allowed
  status: User | "active";       // Error: cannot mix object and enum
};
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
import { defineResolveType } from "../gqlkit";

export const searchResultResolveType = defineResolveType<SearchResult>(
  (value) => {
    if ("name" in value) return "User";
    return "Post";
  }
);
```

See [Abstract Type Resolution](./abstract-resolvers.md) for complete documentation.
