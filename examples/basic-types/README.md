# basic-types

プリミティブ型を持つ最小限の型定義と Query を示すサンプルです。

## Features

- TypeScript interface から GraphQL Object 型への変換
- プリミティブ型（string, number, boolean）のフィールド定義
- QueryResolver による Query フィールド定義

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
    age
    isActive
  }
  users {
    id
    name
  }
}
```
