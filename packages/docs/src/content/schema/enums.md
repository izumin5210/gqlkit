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

## Inline Enums

When you define a string literal union or reference a TypeScript enum **inline** (without exporting it from the schema directory), gqlkit automatically generates a GraphQL enum type. This follows the same pattern as [inline objects](./objects.md#inline-objects).

### Inline String Literal Unions

String literal unions used directly in field or argument types generate enum types automatically:

```typescript
export type User = {
  id: string;
  name: string;
  /** Current account status */
  status: "active" | "inactive" | "pendingReview";
};
```

Generates:

```graphql
type User {
  id: String!
  name: String!
  """Current account status"""
  status: UserStatus!
}

enum UserStatus {
  ACTIVE
  INACTIVE
  PENDING_REVIEW
}
```

The generated enum type name follows the convention `{ParentTypeName}{PascalCaseFieldName}`.

### External TypeScript Enums

TypeScript enums defined outside the schema directory are also automatically converted:

```typescript
// src/types/order.ts (outside schema directory)
/**
 * Order status in the system
 */
export enum OrderStatus {
  /** Order is pending payment */
  Pending = "pending",
  /** Order is being processed */
  Processing = "processing",
  /** Order has been shipped */
  Shipped = "shipped",
}

// src/gqlkit/schema/order.ts
import { OrderStatus } from "../../types/order.js";

export type Order = {
  id: string;
  status: OrderStatus;
};
```

Generates:

```graphql
type Order {
  id: String!
  status: OrderStatus!
}

"""Order status in the system"""
enum OrderStatus {
  """Order is pending payment"""
  PENDING
  """Order is being processed"""
  PROCESSING
  """Order has been shipped"""
  SHIPPED
}
```

TSDoc comments on the enum and its values are preserved as GraphQL descriptions. The `@deprecated` tag is also supported.

When the same external TypeScript enum is referenced in multiple places, gqlkit generates a single GraphQL enum type and reuses it across all references.

### Inline Enum Naming Convention

The naming convention for auto-generated enum types matches [inline objects](./objects.md#inline-objects):

| Context | Naming Pattern | Example |
|---------|----------------|---------|
| Object field | `{ParentTypeName}{PascalCaseFieldName}` | `User.status` → `UserStatus` |
| Input field | `{ParentTypeNameWithoutInputSuffix}{PascalCaseFieldName}Input` | `CreateUserInput.role` → `CreateUserRoleInput` |
| Query/Mutation argument | `{PascalCaseFieldName}{PascalCaseArgName}Input` | `searchUsers(status: ...)` → `SearchUsersStatusInput` |
| Field resolver argument | `{ParentTypeName}{PascalCaseFieldName}{PascalCaseArgName}Input` | `User.posts(filter: ...)` → `UserPostsFilterInput` |

### Nullable Inline Enums

Nullable inline enums are supported:

```typescript
export type User = {
  id: string;
  status: "active" | "inactive" | null;
};
```

Generates:

```graphql
type User {
  id: String!
  status: UserStatus
}

enum UserStatus {
  ACTIVE
  INACTIVE
}
```

### Arrays of Inline Enums

Inline enums in array types are also supported:

```typescript
export type User = {
  id: string;
  roles: ("admin" | "editor" | "viewer")[];
};
```

Generates:

```graphql
type User {
  id: String!
  roles: [UserRoles!]!
}

enum UserRoles {
  ADMIN
  EDITOR
  VIEWER
}
```

### When Enums Are NOT Auto-Generated

If you export a type from the schema directory, it is treated as an explicit type declaration and not auto-generated:

```typescript
// Exported from schema - used as-is, not auto-generated
export type UserStatus = "active" | "inactive" | "pending";

export type User = {
  id: string;
  status: UserStatus;  // References the exported type
};
```

### Inline Enum Payloads

String literal unions in resolver return types generate GraphQL Enum types with the naming convention `{ResolverName}Payload`:

```typescript
export const getStatus = defineQuery<NoArgs, "active" | "inactive" | "pending">(
  (_root, _args, ctx) => ctx.db.getStatus()
);
```

Generates:

```graphql
type Query {
  getStatus: GetStatusPayload!
}

enum GetStatusPayload {
  ACTIVE
  INACTIVE
  PENDING
}
```

For field resolvers, the naming convention is `{ParentTypeName}{PascalCaseFieldName}Payload`:

```typescript
export const status = defineField<User, NoArgs, "online" | "offline" | "away">(
  (parent) => parent.currentStatus
);
```

Generates:

```graphql
type User {
  status: UserStatusPayload!
}

enum UserStatusPayload {
  ONLINE
  OFFLINE
  AWAY
}
```

See [Queries & Mutations](./queries-mutations.md#inline-payload-types) for more details on inline payload types.

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
