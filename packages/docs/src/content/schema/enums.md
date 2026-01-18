# Enum Types

gqlkit converts TypeScript string literal unions and enums to GraphQL enum types.

## String Literal Unions

String literal unions are automatically converted to GraphQL enum types:

```typescript
/**
 * User account status
 */
export type UserStatus = "ACTIVE" | "INACTIVE" | "PENDING";
```

Generates:

```graphql
"""User account status"""
enum UserStatus {
  ACTIVE
  INACTIVE
  PENDING
}
```

## TypeScript Enums

TypeScript string enums are also supported:

```typescript
export enum UserStatus {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
  Pending = "PENDING",
}
```

Generates:

```graphql
enum UserStatus {
  ACTIVE
  INACTIVE
  PENDING
}
```

## Deprecating Enum Values

Use the `@deprecated` JSDoc tag to mark enum values as deprecated:

```typescript
export enum UserStatus {
  Active = "ACTIVE",
  /**
   * @deprecated Use `Inactive` instead
   */
  Pending = "PENDING",
  Inactive = "INACTIVE",
}
```

For string literal unions, use a separate type with JSDoc:

```typescript
/**
 * User account status
 */
export type UserStatus =
  | "ACTIVE"
  | /** @deprecated Use INACTIVE instead */ "PENDING"
  | "INACTIVE";
```

Generates:

```graphql
enum UserStatus {
  ACTIVE
  PENDING @deprecated(reason: "Use INACTIVE instead")
  INACTIVE
}
```

## Using Enums in Types

```typescript
export type User = {
  id: string;
  name: string;
  status: UserStatus;
};

export type UpdateUserInput = {
  status: UserStatus | null;
};
```

Generates:

```graphql
type User {
  id: String!
  name: String!
  status: UserStatus!
}

input UpdateUserInput {
  status: UserStatus
}
```

## Automatic Case Conversion

gqlkit automatically converts enum values to `SCREAMING_SNAKE_CASE` format, which is the GraphQL convention:

```typescript
export type UserStatus = "active" | "inProgress" | "pending_review" | "on-hold";
```

Generates:

```graphql
enum UserStatus {
  ACTIVE
  IN_PROGRESS
  PENDING_REVIEW
  ON_HOLD
}
```

When conversion changes the original value, gqlkit generates resolver mappings to translate between GraphQL and TypeScript values:

```typescript
// Generated resolvers.ts
export function createResolvers() {
  return {
    UserStatus: {
      ACTIVE: "active",
      IN_PROGRESS: "inProgress",
      PENDING_REVIEW: "pending_review",
      ON_HOLD: "on-hold",
    },
  };
}
```

If values are already in `SCREAMING_SNAKE_CASE`, no resolver mapping is generated.

### Duplicate Value Detection

If multiple TypeScript values convert to the same GraphQL enum value, gqlkit reports a `DUPLICATE_ENUM_VALUE_AFTER_CONVERSION` error:

```typescript
// Error: 'activeUser' and 'active_user' both convert to ACTIVE_USER
export type Status = "activeUser" | "active_user" | "pending";
```

## Invalid Enum Values

Enum values that are not valid GraphQL identifiers are automatically skipped with a warning. gqlkit converts enum values to `SCREAMING_SNAKE_CASE`, and the converted name must:

- Match the pattern `/^[_A-Za-z][_0-9A-Za-z]*$/`
- Not start with `__` (reserved for GraphQL introspection)

### String Literal Unions

```typescript
export type Status =
  | "active"      // ✅ Converts to ACTIVE
  | "inProgress"  // ✅ Converts to IN_PROGRESS
  | "0pending"    // ⚠️ Skipped: converts to 0PENDING (starts with number)
  | "__internal"; // ⚠️ Skipped: converts to __INTERNAL (starts with __)
```

Generates:

```graphql
enum Status {
  ACTIVE
  IN_PROGRESS
}
```

### TypeScript Enums

```typescript
export enum Priority {
  HIGH = "HIGH",           // ✅ Valid
  MEDIUM = "MEDIUM",       // ✅ Valid
  LOW = "LOW",             // ✅ Valid
  "0INVALID" = "0INVALID", // ⚠️ Skipped: starts with number
  __RESERVED = "__RESERVED", // ⚠️ Skipped: starts with __
}
```

Generates:

```graphql
enum Priority {
  HIGH
  MEDIUM
  LOW
}
```

When enum values are skipped, gqlkit outputs a warning with the original name, converted name, and location.
