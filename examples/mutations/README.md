# mutations

Mutation の定義方法を示すサンプルです。

## Features

- MutationResolver による Mutation フィールド定義
- 引数を持つ Mutation フィールド
- 戻り値型を持つ Mutation フィールド

## Quick Start

```bash
pnpm install
pnpm gen
pnpm start
```

## Example Query

```graphql
query {
  users {
    id
    name
    email
  }
}

mutation {
  createUser(name: "Charlie", email: "charlie@example.com") {
    id
    name
    email
  }
}

mutation {
  updateUser(id: "1", name: "Alice Updated") {
    id
    name
  }
}

mutation {
  deleteUser(id: "1")
}
```
