# Object Types

Plain TypeScript type exports become GraphQL Object types.

## Basic Usage

Export a TypeScript type or interface:

```typescript
// src/gqlkit/schema/user.ts
import { defineQuery, defineField } from "../gqlkit";
import type { IDString, Int, NoArgs } from "@gqlkit-ts/runtime";

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

Similarly, inline string literal unions and external TypeScript enums are automatically converted to GraphQL enum types. See [Inline Enums](./enums.md#inline-enums) for details.

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

## Excluding Fields

Use `GqlObject` with the `ignoreFields` option to exclude specific fields from the generated GraphQL schema. This is useful for internal fields that should not be exposed in the public API:

```typescript
import { type GqlObject, type IDString } from "@gqlkit-ts/runtime";

/**
 * A user in the system.
 */
export type User = GqlObject<
  {
    id: IDString;
    name: string;
    email: string | null;
    internalId: string;  // Internal field - excluded from schema
    cacheKey: string;    // Internal field - excluded from schema
  },
  { ignoreFields: "internalId" | "cacheKey" }
>;
```

Generates:

```graphql
"""A user in the system."""
type User {
  id: ID!
  name: String!
  email: String
}
```

The excluded fields (`internalId` and `cacheKey`) are not included in the generated schema, and no resolvers are generated for them.

### Type Safety

The `ignoreFields` option is type-safe. TypeScript will report an error if you specify a field name that doesn't exist in the type:

```typescript
// ✅ OK: Field exists
export type User = GqlObject<
  { id: string; name: string; internal: string },
  { ignoreFields: "internal" }
>;

// ❌ Error: "nonExistent" is not a field of this type
export type BadUser = GqlObject<
  { id: string; name: string },
  { ignoreFields: "nonExistent" }
>;
```

### Combining with Other Options

You can combine `ignoreFields` with `implements` and `directives`:

```typescript
export type Product = GqlObject<
  {
    id: IDString;
    name: string;
    price: number;
    internalCost: number;
    supplierCode: string;
  },
  {
    implements: [Node],
    directives: [CacheDirective],
    ignoreFields: "internalCost" | "supplierCode"
  }
>;
```

### Validation

gqlkit validates `ignoreFields` at generation time:

- **Unknown field**: Error if a specified field doesn't exist in the type
- **All fields excluded**: Error if all fields would be excluded (at least one field must remain)
- **Interface fields**: Error if excluding a field that's required by an implemented interface

## Invalid Field Names

Field names that are not valid GraphQL identifiers are automatically skipped with a warning. Valid GraphQL names must:

- Match the pattern `/^[_A-Za-z][_0-9A-Za-z]*$/`
- Not start with `__` (reserved for GraphQL introspection)

```typescript
export type User = {
  id: string;              // ✅ Valid
  userName: string;        // ✅ Valid
  _internal: string;       // ✅ Valid (single underscore is OK)
  "0invalid": string;      // ⚠️ Skipped: starts with a number
  __reserved: string;      // ⚠️ Skipped: starts with __
  "field-name": string;    // ⚠️ Skipped: contains hyphen
};
```

Generates (invalid fields are skipped):

```graphql
type User {
  id: String!
  userName: String!
  _internal: String!
}
```

When fields are skipped, gqlkit outputs a warning with the field name and location.
