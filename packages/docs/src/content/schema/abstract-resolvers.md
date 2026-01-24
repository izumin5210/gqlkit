# Abstract Type Resolution

GraphQL abstract types (unions and interfaces) require runtime type resolution to determine the concrete type of returned values. gqlkit provides `defineResolveType` and `defineIsTypeOf` to handle this.

## Overview

When a GraphQL query returns an abstract type, the server needs to determine which concrete type to use. There are two approaches:

| Approach | Defined On | Returns | Use Case |
|----------|------------|---------|----------|
| `resolveType` | Abstract type (union/interface) | Type name string | Single resolver decides the type |
| `isTypeOf` | Object type | Boolean | Each type checks if value matches |

## Automatic resolveType Generation

When Union or Interface member types have `__typename` or `$typeName` fields with string literal values, gqlkit automatically generates the `resolveType` function. No manual definition is needed.

### Basic Example

```typescript
export interface User {
  __typename: "User";
  id: string;
  name: string;
}

export interface Post {
  __typename: "Post";
  id: string;
  title: string;
}

export type SearchResult = User | Post;
// resolveType is automatically generated: (obj) => obj.__typename
```

### Using `$typeName`

If you prefer not to use `__typename` (e.g., to avoid conflicts with GraphQL introspection), you can use `$typeName` instead:

```typescript
export interface User {
  $typeName: "User";
  id: string;
  name: string;
}

export interface Post {
  $typeName: "Post";
  id: string;
  title: string;
}

export type SearchResult = User | Post;
// resolveType is automatically generated: (obj) => obj.$typeName
```

### Priority Rules

When both `__typename` and `$typeName` are present, `__typename` takes priority:

```typescript
export interface User {
  __typename: "User";  // This value is used
  $typeName: "UserType";
  id: string;
}
```

### Mixed Patterns

When some members use `__typename` and others use `$typeName`, gqlkit generates a fallback pattern:

```typescript
export interface User {
  __typename: "User";
  id: string;
}

export interface Post {
  $typeName: "Post";
  id: string;
}

export type SearchResult = User | Post;
// resolveType: (obj) => obj.__typename ?? obj.$typeName
```

### Requirements

For automatic generation, the typename field must be:

- Named `__typename` or `$typeName`
- A **non-optional** field
- A **non-nullable** type
- A **string literal** type (not `string`)

```typescript
// ✅ OK: Valid typename fields
interface Valid {
  __typename: "TypeA";       // string literal, required
}

// ❌ Error: These will not trigger auto-generation
interface Invalid1 {
  __typename?: "TypeA";      // optional field
}

interface Invalid2 {
  __typename: "TypeA" | null; // nullable type
}

interface Invalid3 {
  __typename: string;        // not a string literal
}
```

### When to Use Manual defineResolveType

Use `defineResolveType` manually when:

- Your types don't have `__typename` or `$typeName` fields
- You need custom resolution logic (e.g., checking other properties)
- You want to override the automatic generation

## Using resolveType

Define a `resolveType` resolver on a union or interface type to determine the concrete type.

### Union Example

```typescript
import { defineResolveType } from "../gqlkit";

export interface User {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  title: string;
}

export type SearchResult = User | Post;

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
import { defineResolveType } from "../gqlkit";
import { type GqlInterface, type IDString } from "@gqlkit-ts/runtime";

export type Node = GqlInterface<{
  id: IDString;
}>;

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
import { defineIsTypeOf } from "../gqlkit";

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
