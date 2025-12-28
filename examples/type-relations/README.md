# type-relations

型間の参照関係、nullable フィールド、リスト型を示すサンプルです。

## Features

- 他の GraphQL 型を参照するフィールド（User.posts, Post.author）
- nullable フィールド（`T | null`）の定義
- リスト型（`T[]`）のフィールド定義
- 2つ以上の関連する型

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
    email
    posts {
      id
      title
      content
    }
  }
  posts {
    id
    title
    author {
      name
    }
  }
}
```
