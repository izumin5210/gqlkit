# enums

TypeScript enum と string literal union の GraphQL Enum 変換を示すサンプルです。

## Features

- TypeScript enum から GraphQL Enum への変換
- string literal union から GraphQL Enum への変換
- enum を参照するフィールド定義
- SCREAMING_SNAKE_CASE 変換

## Quick Start

```bash
pnpm install
pnpm gen
pnpm start
```

## Example Query

```graphql
{
  user {
    id
    name
    status
    role
  }
  users {
    id
    status
    role
  }
}
```

## Generated Enum

TypeScript:
```typescript
enum Status { Active = "active", Inactive = "inactive", Pending = "pending" }
type Role = "admin" | "user" | "guest";
```

GraphQL:
```graphql
enum Status { ACTIVE, INACTIVE, PENDING }
enum Role { ADMIN, USER, GUEST }
```
