# type-extensions

既存型への計算フィールド追加（フィールドリゾルバ）を示すサンプルです。

## Features

- type-extractor で定義された型に対するフィールドリゾルバ
- `{TypeName}Resolver` と `{typeName}Resolver` の命名規則
- parent 引数を受け取るフィールドリゾルバ
- 拡張フィールドが `extend type` として出力

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
    firstName
    lastName
    fullName
    posts {
      id
      title
    }
  }
}
```
