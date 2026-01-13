# Abstract Type Resolution

GraphQL abstract types (unions and interfaces) require runtime type resolution to determine the concrete type of returned values. gqlkit provides `defineResolveType` and `defineIsTypeOf` to handle this.

## Overview

When a GraphQL query returns an abstract type, the server needs to determine which concrete type to use. There are two approaches:

| Approach | Defined On | Returns | Use Case |
|----------|------------|---------|----------|
| `resolveType` | Abstract type (union/interface) | Type name string | Single resolver decides the type |
| `isTypeOf` | Object type | Boolean | Each type checks if value matches |

## Using resolveType

Define a `resolveType` resolver on a union or interface type to determine the concrete type.

### Union Example

```typescript
import { createGqlkitApis } from "@gqlkit-ts/runtime";

export interface User {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  title: string;
}

export type SearchResult = User | Post;

const { defineResolveType } = createGqlkitApis<Context>();

export const searchResultResolveType = defineResolveType<SearchResult>(
  (value) => {
    if ("name" in value) {
      return "User";
    }
    return "Post";
  }
);
```

### Interface Example

```typescript
import {
  createGqlkitApis,
  type GqlInterface,
  type IDString,
} from "@gqlkit-ts/runtime";

export type Node = GqlInterface<{
  id: IDString;
}>;

const { defineResolveType } = createGqlkitApis<Context>();

export const nodeResolveType = defineResolveType<Node>((value) => {
  if ("name" in value) {
    return "User";
  }
  if ("title" in value) {
    return "Post";
  }
  throw new Error("Unknown Node type");
});
```

### Resolver Function Signature

```typescript
(value: TAbstract, context: TContext, info: GraphQLResolveInfo) => string | Promise<string>
```

| Argument | Description |
|----------|-------------|
| `value` | The resolved value to determine the type of |
| `context` | The context object |
| `info` | GraphQL resolve info |

### Type Parameters

`defineResolveType<TAbstract>`:

| Parameter | Description |
|-----------|-------------|
| `TAbstract` | The abstract type (union or interface) to resolve |

## Using isTypeOf

Define an `isTypeOf` resolver on an object type to check if a value is of that type.

### Basic Usage

```typescript
import { createGqlkitApis } from "@gqlkit-ts/runtime";

export interface Dog {
  kind: string;
  name: string;
  breed: string;
}

export interface Cat {
  kind: string;
  name: string;
  indoor: boolean;
}

export type Animal = Dog | Cat;

const { defineIsTypeOf } = createGqlkitApis<Context>();

export const dogIsTypeOf = defineIsTypeOf<Dog>((value) => {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "dog"
  );
});

export const catIsTypeOf = defineIsTypeOf<Cat>((value) => {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "cat"
  );
});
```

### Resolver Function Signature

```typescript
(value: unknown, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>
```

| Argument | Description |
|----------|-------------|
| `value` | The value to check (typed as `unknown`) |
| `context` | The context object |
| `info` | GraphQL resolve info |

### Type Parameters

`defineIsTypeOf<TObject>`:

| Parameter | Description |
|-----------|-------------|
| `TObject` | The object type to check against |
