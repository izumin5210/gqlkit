---
title: Defining Custom Directives
description: Define custom directives using the GqlDirective utility type.
---

# Custom Directives

Define custom directives using the `GqlDirective` utility type and attach them using `GqlField` or `GqlObject`.

## Defining Directives

```typescript
// src/gqlkit/schema/directives.ts
import { type GqlDirective } from "@gqlkit-ts/runtime";

export type Role = "USER" | "ADMIN";

// Directive with typed arguments
export type AuthDirective<TArgs extends { role: Role[] }> = GqlDirective<
  "auth",
  TArgs,
  "FIELD_DEFINITION"
>;

// Directive with multiple locations
export type CacheDirective<TArgs extends { maxAge: number }> = GqlDirective<
  "cache",
  TArgs,
  ["FIELD_DEFINITION", "OBJECT"]
>;
```

Generates:

```graphql
directive @auth(role: [Role!]!) on FIELD_DEFINITION
directive @cache(maxAge: Float!) on FIELD_DEFINITION | OBJECT
```

## GqlDirective Type Parameters

`GqlDirective<Name, Args, Location>`:

| Parameter | Description |
|-----------|-------------|
| `Name` | The directive name (without `@`) |
| `Args` | The directive arguments type |
| `Location` | Where the directive can be used (single or array) |

### Directive Locations

Common directive locations:

| Location | Description |
|----------|-------------|
| `FIELD_DEFINITION` | Object type fields |
| `OBJECT` | Object types |
| `INPUT_FIELD_DEFINITION` | Input type fields |
| `ARGUMENT_DEFINITION` | Field arguments |
| `ENUM_VALUE` | Enum values |
| `INTERFACE` | Interface types |

## Attaching Directives to Fields

Use `GqlField` to attach directives to object type fields:

```typescript
import { type GqlField, type IDString } from "@gqlkit-ts/runtime";
import { type AuthDirective } from "./directives.js";

export type User = {
  id: IDString;
  name: string;
  // Field with directive
  email: GqlField<string, { directives: [AuthDirective<{ role: ["ADMIN"] }>] }>;
  // Nullable field with directive
  phone: GqlField<string | null, { directives: [AuthDirective<{ role: ["USER"] }>] }>;
};
```

Generates:

```graphql
type User {
  id: ID!
  name: String!
  email: String! @auth(role: [ADMIN])
  phone: String @auth(role: [USER])
}
```

## Attaching Directives to Types

Use `GqlObject` to attach directives to type definitions:

```typescript
import { type GqlObject, type IDString } from "@gqlkit-ts/runtime";
import { type CacheDirective } from "./directives.js";

export type Post = GqlObject<
  {
    id: IDString;
    title: string;
  },
  { directives: [CacheDirective<{ maxAge: 60 }>] }
>;
```

Generates:

```graphql
type Post @cache(maxAge: 60) {
  id: ID!
  title: String!
}
```

## Attaching Directives to Query/Mutation Fields

Add a third type parameter to `defineQuery`, `defineMutation`, or `defineSubscription`:

```typescript
import { defineQuery } from "../gqlkit";
import type { NoArgs } from "@gqlkit-ts/runtime";
import { type AuthDirective } from "./directives.js";
import type { User } from "./user.js";

// Query field with directive
export const me = defineQuery<
  NoArgs,
  User,
  [AuthDirective<{ role: ["USER"] }>]
>((_root, _args, ctx) => ctx.currentUser);
```

Generates:

```graphql
type Query {
  me: User! @auth(role: [USER])
}
```

## Attaching Directives to Field Resolvers

Add a fourth type parameter to `defineField`:

```typescript
import { defineField } from "../gqlkit";
import type { NoArgs } from "@gqlkit-ts/runtime";
import { type AuthDirective } from "./directives.js";

export const email = defineField<
  User,
  NoArgs,
  string,
  [AuthDirective<{ role: ["ADMIN"] }>]
>((parent) => parent.email);
```

## Attaching Directives to Arguments

Wrap an argument type with `GqlField`, as with input type fields. This works for the arguments of `defineQuery`, `defineMutation`, `defineSubscription`, and `defineField`. The directive must include `ARGUMENT_DEFINITION` in its locations:

```typescript
import { type GqlDirective, type GqlField } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit";
import type { User } from "./user.js";

export type SensitiveDirective = GqlDirective<
  "sensitive",
  Record<string, never>,
  ["ARGUMENT_DEFINITION", "INPUT_FIELD_DEFINITION"]
>;

export const login = defineQuery<
  {
    email: string;
    password: GqlField<string, { directives: [SensitiveDirective] }>;
  },
  User | null
>((_root, args, ctx) => ctx.auth.login(args.email, args.password));
```

Generates:

```graphql
directive @sensitive on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION

type Query {
  login(email: String!, password: String! @sensitive): User
}
```

When the arguments type is a named type, its fields become the arguments and keep their directives. A directive declared only for `INPUT_FIELD_DEFINITION` is then reported as `INVALID_DIRECTIVE_LOCATION`, so declare both locations for directives you use on such types.

## Multiple Directives

Attach multiple directives by adding them to the array:

```typescript
export type Post = GqlObject<
  {
    id: IDString;
    title: string;
  },
  {
    directives: [
      CacheDirective<{ maxAge: 60 }>,
      AuthDirective<{ role: ["USER"] }>
    ]
  }
>;
```

## Combining with Other Options

Combine directives with `implements` and `defaultValue`:

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

export type CreatePostInput = {
  title: GqlField<string, {
    defaultValue: "Untitled";
    directives: [LengthDirective<{ min: 1; max: 200 }>];
  }>;
};
```

## Federation Directives

For Apollo Federation subgraphs, use the directive types from `@gqlkit-ts/runtime/federation` (`Key`, `Shareable`, `Inaccessible`) instead of defining them with `GqlDirective`. See [Apollo Federation](../integration/apollo-federation.md#federation-directives).
