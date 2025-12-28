# field-arguments

Query フィールドへの引数渡しを示すサンプルです。

## Features

- Query フィールドに引数を持つリゾルバ定義
- 複数の引数を持つフィールド（limit, offset）
- nullable な引数と non-nullable な引数の両方

## Quick Start

```bash
pnpm install
pnpm gen
pnpm start
```

## Example Query

```graphql
{
  user(id: "1") {
    id
    name
  }
  users(limit: 10, offset: 0) {
    id
    name
  }
  search(query: "alice", includeInactive: false) {
    id
    name
  }
}
```
