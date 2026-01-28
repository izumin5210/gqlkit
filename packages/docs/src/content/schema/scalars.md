---
title: Defining Scalar Types
description: gqlkit provides built-in scalar types and supports custom scalar definitions.
---

# Scalar Types

gqlkit provides built-in scalar types and supports custom scalar definitions.

## Built-in Scalar Types

gqlkit provides branded types to explicitly specify GraphQL scalar mappings:

| TypeScript type | GraphQL type |
|-----------------|--------------|
| `IDString`      | `ID!`        |
| `IDNumber`      | `ID!`        |
| `Int`           | `Int!`       |
| `Float`         | `Float!`     |
| `string`        | `String!`    |
| `number`        | `Float!`     |
| `boolean`       | `Boolean!`   |

### Usage

```typescript
import { type IDString, type Int, type Float } from "@gqlkit-ts/runtime";

export type User = {
  id: IDString;       // ID!
  age: Int;           // Int!
  score: Float;       // Float!
  name: string;       // String!
  balance: number;    // Float!
  active: boolean;    // Boolean!
};
```

## Branded Types

gqlkit automatically recognizes TypeScript branded types (intersection types with brand markers) and maps them to the appropriate default GraphQL scalars:

```typescript
// Define branded types
type UserId = string & { __brand: "UserId" };
type Price = number & { readonly __brand: unique symbol };
type IsVerified = boolean & { __nominal: true };

export type Product = {
  id: UserId;         // → String!
  price: Price;       // → Float!
  verified: IsVerified; // → Boolean!
};
```

### Supported Brand Patterns

gqlkit recognizes the following brand marker property names:

- `__brand`, `_brand`, `brand`
- `__nominal`, `_nominal`
- `__tag`, `_tag`

### Custom Scalars for Branded Types

To map a branded type to a custom scalar instead of the default, use the config:

```typescript
// gqlkit.config.ts
import { defineConfig } from "@gqlkit-ts/cli";

export default defineConfig({
  scalars: [
    {
      name: "UserID",
      tsType: { name: "UserId" },
    },
  ],
});
```

This maps `UserId` to the custom `UserID` scalar instead of `String`.

## Custom Scalars with GqlScalar

Define custom scalar types using the `GqlScalar` utility type:

```typescript
// src/gqlkit/schema/scalars.ts
import { type GqlScalar } from "@gqlkit-ts/runtime";

/**
 * ISO 8601 format date-time string
 */
export type DateTime = GqlScalar<"DateTime", Date>;
```

Generates:

```graphql
"""ISO 8601 format date-time string"""
scalar DateTime
```

### GqlScalar Type Parameters

`GqlScalar<Name, Base, Only?>`:

| Parameter | Description |
|-----------|-------------|
| `Name` | The GraphQL scalar name |
| `Base` | The TypeScript type that backs this scalar |
| `Only` | Optional: `"input"` or `"output"` to restrict usage |

### Input-only and Output-only Scalars

Restrict scalar usage to input or output positions:

```typescript
import { type GqlScalar } from "@gqlkit-ts/runtime";

// Input-only scalar (for input positions only)
export type DateTimeInput = GqlScalar<"DateTime", Date, "input">;

// Output-only scalar (for output positions only)
export type DateTimeOutput = GqlScalar<"DateTime", Date | string, "output">;
```

This is useful when input and output representations differ.

## Config-based Custom Scalars

Alternatively, map TypeScript types to GraphQL custom scalars via config:

```typescript
// gqlkit.config.ts
import { defineConfig } from "@gqlkit-ts/cli";

export default defineConfig({
  scalars: [
    {
      name: "DateTime",
      tsType: { from: "./src/gqlkit/schema/scalars", name: "DateTime" },
      description: "ISO 8601 datetime string",
    },
    {
      name: "UUID",
      tsType: { name: "string" },  // Global type
      only: "input",  // Input-only scalar
    },
  ],
});
```

### Config Options

| Option | Description |
|--------|-------------|
| `name` | The GraphQL scalar name |
| `tsType.name` | The TypeScript type name |
| `tsType.from` | Optional: import path for the type |
| `description` | Optional: GraphQL description |
| `only` | Optional: `"input"` or `"output"` |

## Using Custom Scalars

Once defined, use custom scalars in your types:

```typescript
import type { DateTime } from "./scalars.js";

export type User = {
  id: IDString;
  name: string;
  createdAt: DateTime;
  updatedAt: DateTime | null;
};

export type CreateUserInput = {
  name: string;
  birthDate: DateTime;
};
```

## Registering Scalar Resolvers

Custom scalars require resolver implementations to handle serialization and parsing at runtime. Pass scalar resolvers to `createResolvers`:

```typescript
import { createResolvers } from "./gqlkit/__generated__/resolvers.js";

const resolvers = createResolvers({
  scalars: {
    DateTime: myDateTimeScalar,
  },
});
```

### Using graphql-scalars (Recommended)

The easiest way to implement custom scalars is to use [graphql-scalars](https://the-guild.dev/graphql/scalars), which provides ready-to-use implementations for common scalar types:

```typescript
import { GraphQLDateTime } from "graphql-scalars";

const resolvers = createResolvers({
  scalars: {
    DateTime: GraphQLDateTime,
  },
});
```

This approach requires no manual serialize/parse implementation.

### Custom Implementation

For custom behavior, create your own `GraphQLScalarType`:

```typescript
import { GraphQLScalarType, Kind } from "graphql";

const DateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO 8601 date-time string",
  serialize(value) {
    return value instanceof Date ? value.toISOString() : value;
  },
  parseValue(value) {
    return new Date(value as string);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

const resolvers = createResolvers({
  scalars: {
    DateTime: DateTimeScalar,
  },
});
```
