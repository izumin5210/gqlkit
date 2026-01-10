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
