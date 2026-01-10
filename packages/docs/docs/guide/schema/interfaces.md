# Interface Types

Define GraphQL interface types using the `GqlInterface` utility type.

## Basic Usage

```typescript
// src/gqlkit/schema/node.ts
import { type GqlInterface, type IDString } from "@gqlkit-ts/runtime";
import type { DateTime } from "./scalars.js";

/**
 * Node interface - represents any entity with a unique identifier.
 */
export type Node = GqlInterface<{
  /** Global unique identifier */
  id: IDString;
}>;

/**
 * Timestamped interface - entities that track creation time.
 */
export type Timestamped = GqlInterface<{
  createdAt: DateTime;
}>;
```

Generates:

```graphql
"""Node interface - represents any entity with a unique identifier."""
interface Node {
  """Global unique identifier"""
  id: ID!
}

"""Timestamped interface - entities that track creation time."""
interface Timestamped {
  createdAt: DateTime!
}
```

## GqlInterface Type Parameters

`GqlInterface<T, Meta?>`:

| Parameter | Description |
|-----------|-------------|
| `T` | The interface fields definition |
| `Meta` | Optional: `{ implements: [...] }` for interface inheritance |

## Interface Inheritance

Interfaces can extend other interfaces:

```typescript
/**
 * Entity interface - combines Node and Timestamped.
 */
export type Entity = GqlInterface<
  {
    id: IDString;
    createdAt: DateTime;
  },
  { implements: [Node, Timestamped] }
>;
```

Generates:

```graphql
"""Entity interface - combines Node and Timestamped."""
interface Entity implements Node & Timestamped {
  id: ID!
  createdAt: DateTime!
}
```

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

## Combining with Directives

You can combine `implements` with `directives`:

```typescript
import { type GqlObject, type IDString } from "@gqlkit-ts/runtime";
import type { Node, Timestamped } from "./node.js";
import type { DateTime } from "./scalars.js";
import type { CacheDirective } from "./directives.js";

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

Generates:

```graphql
type Post @cache(maxAge: 60) implements Node & Timestamped {
  id: ID!
  title: String!
  createdAt: DateTime!
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

See [Object Types](./objects.md) for more details on implementing interfaces.
