# Input Types

TypeScript types with `Input` suffix are treated as GraphQL input types.

## Basic Usage

```typescript
/** Input for creating a new user */
export interface CreateUserInput {
  name: string;
  email: string | null;
}
```

Generates:

```graphql
"""Input for creating a new user"""
input CreateUserInput {
  name: String!
  email: String
}
```

## Inline Objects

Input types can use inline object literals for nested structures. gqlkit automatically generates Input Object types with the naming convention `{ParentTypeNameWithoutInputSuffix}{PascalCaseFieldName}Input`:

```typescript
import type { GqlField, Int } from "@gqlkit-ts/runtime";

export type CreateUserInput = {
  name: string;
  /** Profile information */
  profile: {
    bio: string | null;
    /** User's age with default value */
    age: GqlField<Int | null, { defaultValue: 18 }>;
  };
};
```

Generates:

```graphql
input CreateUserInput {
  name: String!
  """Profile information"""
  profile: CreateUserProfileInput!
}

input CreateUserProfileInput {
  """User's age with default value"""
  age: Int = 18
  bio: String
}
```

Nested inline objects generate types with concatenated names (e.g., `UserProfileInput.address` → `UserProfileAddressInput`).

Similarly, inline string literal unions and external TypeScript enums are automatically converted to GraphQL enum types. See [Inline Enums](./enums.md#inline-enums) for details.

## @oneOf Input Objects

Union types with `Input` suffix using inline object literals generate `@oneOf` input objects. Each union member must be an inline object literal with exactly one property. Property values can be scalar types, enum types, or references to Input Object types:

```typescript
/**
 * Specifies how to identify a product.
 * Exactly one field must be provided.
 */
export type ProductInput =
  | { id: string }
  | { name: string }
  | { location: LocationInput };
```

Generates:

```graphql
"""
Specifies how to identify a product.
Exactly one field must be provided.
"""
input ProductInput @oneOf {
  id: String
  location: LocationInput
  name: String
}
```

Each property becomes a nullable field in the generated input type. The `@oneOf` directive ensures exactly one field is provided at runtime.

### Inline @oneOf in Input Fields

Union types can be used as field types within Input Objects to create nested `@oneOf` input objects. The generated type name follows the convention `{ParentTypeNameWithoutInputSuffix}{PascalCaseFieldName}Input`:

```typescript
export type CreateUserInput = {
  name: string;
  /**
   * User identifier - either by ID or email
   */
  identifier: { id: string } | { email: string };
};
```

Generates:

```graphql
input CreateUserInput {
  name: String!
  """User identifier - either by ID or email"""
  identifier: CreateUserIdentifierInput!
}

input CreateUserIdentifierInput @oneOf {
  email: String
  id: String
}
```

### Inline @oneOf in Resolver Arguments

Inline unions in resolver arguments are also converted to `@oneOf` input objects:

**Query/Mutation arguments** - naming convention: `{PascalCaseResolverName}{PascalCaseArgPath}Input`

```typescript
export const findUser = defineQuery<
  {
    criteria: {
      identifier: { id: string } | { email: string };
    };
  },
  User | null
>(...);
```

Generates:

```graphql
input FindUserCriteriaIdentifierInput @oneOf {
  email: String
  id: String
}

input FindUserCriteriaInput {
  identifier: FindUserCriteriaIdentifierInput!
}

type Query {
  findUser(criteria: FindUserCriteriaInput!): User
}
```

**Field resolver arguments** - naming convention: `{ParentTypeName}{PascalCaseFieldName}{PascalCaseArgPath}Input`

```typescript
export const posts = defineField<
  User,
  {
    filter: { status: string } | { createdAfter: string } | null;
  },
  Post[]
>(...);
```

Generates:

```graphql
input UserPostsFilterInput @oneOf {
  createdAfter: String
  status: String
}

type User {
  posts(filter: UserPostsFilterInput): [Post!]!
}
```

## Default Values

Specify default values for Input Object fields using `GqlField` with the `defaultValue` option.

### Basic Default Values

```typescript
import { type GqlField, type Int } from "@gqlkit-ts/runtime";

export type PaginationInput = {
  limit: GqlField<Int, { defaultValue: 10 }>;
  offset: GqlField<Int, { defaultValue: 0 }>;
  includeArchived: GqlField<boolean, { defaultValue: false }>;
};

export type SearchInput = {
  query: string;
  caseSensitive: GqlField<boolean, { defaultValue: true }>;
  maxResults: GqlField<Int | null, { defaultValue: null }>;
};

export type GreetingInput = {
  name: GqlField<string, { defaultValue: "World" }>;
  prefix: GqlField<string, { defaultValue: "Hello" }>;
};
```

Generates:

```graphql
input PaginationInput {
  limit: Int! = 10
  offset: Int! = 0
  includeArchived: Boolean! = false
}

input SearchInput {
  query: String!
  caseSensitive: Boolean! = true
  maxResults: Int = null
}

input GreetingInput {
  name: String! = "World"
  prefix: String! = "Hello"
}
```

### Complex Default Values

Default values support arrays, objects, and enum values:

```typescript
export type Status = "ACTIVE" | "INACTIVE" | "PENDING";

export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type NestedConfig = {
  enabled: boolean;
  value: Int;
};

export type FilterInput = {
  status: GqlField<Status, { defaultValue: "ACTIVE" }>;
  priorities: GqlField<Priority[], { defaultValue: ["MEDIUM", "HIGH"] }>;
  tags: GqlField<string[], { defaultValue: ["default"] }>;
};

export type SettingsInput = {
  config: GqlField<NestedConfig, { defaultValue: { enabled: true; value: 100 } }>;
  limits: GqlField<Int[], { defaultValue: [10, 20, 30] }>;
};
```

Generates:

```graphql
input FilterInput {
  status: Status! = ACTIVE
  priorities: [Priority!]! = [MEDIUM, HIGH]
  tags: [String!]! = ["default"]
}

input SettingsInput {
  config: NestedConfig! = {enabled: true, value: 100}
  limits: [Int!]! = [10, 20, 30]
}
```

### Default Values with Directives

You can combine `defaultValue` with `directives`:

```typescript
import { type GqlField, type GqlDirective, type Int } from "@gqlkit-ts/runtime";

export type LengthDirective<TArgs extends { min: number; max: number }> =
  GqlDirective<"length", TArgs, "INPUT_FIELD_DEFINITION" | "ARGUMENT_DEFINITION">;

export type RangeDirective<TArgs extends { min: number; max: number }> =
  GqlDirective<"range", TArgs, "INPUT_FIELD_DEFINITION" | "ARGUMENT_DEFINITION">;

export type CreateUserInput = {
  name: GqlField<string, {
    defaultValue: "Anonymous";
    directives: [LengthDirective<{ min: 1; max: 100 }>];
  }>;
  age: GqlField<Int, {
    defaultValue: 18;
    directives: [RangeDirective<{ min: 0; max: 150 }>];
  }>;
  email: GqlField<string | null, {
    defaultValue: null;
    directives: [LengthDirective<{ min: 5; max: 255 }>];
  }>;
};
```

Generates:

```graphql
input CreateUserInput {
  name: String! = "Anonymous" @length(min: 1, max: 100)
  age: Int! = 18 @range(min: 0, max: 150)
  email: String = null @length(min: 5, max: 255)
}
```

### Supported Default Value Types

| Value type | Example | GraphQL output |
|------------|---------|----------------|
| String | `"hello"` | `"hello"` |
| Number (Int) | `10` | `10` |
| Number (Float) | `3.14` | `3.14` |
| Boolean | `true`, `false` | `true`, `false` |
| Null | `null` | `null` |
| Array | `[1, 2, 3]` | `[1, 2, 3]` |
| Object | `{ key: "value" }` | `{key: "value"}` |
| Enum | `"ACTIVE"` (when field type is enum) | `ACTIVE` |

### Literal Types Required

Default values must be specified as TypeScript literal types. Non-literal types will cause a warning:

```typescript
// ✅ OK: Literal types
export type GoodInput = {
  limit: GqlField<Int, { defaultValue: 10 }>;
  name: GqlField<string, { defaultValue: "default" }>;
};

// ❌ Error: Non-literal types
export type BadInput = {
  limit: GqlField<Int, { defaultValue: number }>;     // Warning: must be literal
  name: GqlField<string, { defaultValue: string }>;   // Warning: must be literal
};
```

## Excluding Fields

Use `GqlObject` with the `ignoreFields` option to exclude specific fields from the generated Input Object. This is useful for internal fields that should not be accepted from clients:

```typescript
import { type GqlObject } from "@gqlkit-ts/runtime";

/**
 * Input for creating a user.
 */
export type CreateUserInput = GqlObject<
  {
    name: string;
    email: string;
    internalData: string;  // Internal field - excluded from schema
    trackingId: string;    // Internal field - excluded from schema
  },
  { ignoreFields: "internalData" | "trackingId" }
>;
```

Generates:

```graphql
"""Input for creating a user."""
input CreateUserInput {
  name: String!
  email: String!
}
```

## Invalid Field Names

Input field names that are not valid GraphQL identifiers are automatically skipped with a warning. Valid GraphQL names must:

- Match the pattern `/^[_A-Za-z][_0-9A-Za-z]*$/`
- Not start with `__` (reserved for GraphQL introspection)

```typescript
export type CreateUserInput = {
  name: string;            // ✅ Valid
  _metadata: string;       // ✅ Valid (single underscore is OK)
  "123abc": string;        // ⚠️ Skipped: starts with a number
  __private: string;       // ⚠️ Skipped: starts with __
  "hyphen-field": string;  // ⚠️ Skipped: contains hyphen
};
```

Generates (invalid fields are skipped):

```graphql
input CreateUserInput {
  name: String!
  _metadata: String!
}
```

When fields are skipped, gqlkit outputs a warning with the field name and location.
