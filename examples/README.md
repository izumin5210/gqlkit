# gqlkit Examples

gqlkit の主要機能を示す最小限の動作例集です。

## Examples Overview

| Example | Description |
|---------|-------------|
| [basic-types](./basic-types) | プリミティブ型（string, number, boolean）を持つ基本的な型定義 |
| [type-relations](./type-relations) | 型間の参照関係、nullable フィールド、リスト型 |
| [field-arguments](./field-arguments) | Query フィールドへの引数渡し |
| [type-extensions](./type-extensions) | 既存型への計算フィールド追加（フィールドリゾルバ） |
| [enums](./enums) | TypeScript enum と string literal union の GraphQL Enum 変換 |
| [mutations](./mutations) | Mutation の定義方法 |

## Quick Start

各サンプルを実行するには:

```bash
cd examples/<example-name>
pnpm install
pnpm gen
pnpm start
```

サーバー起動後、ブラウザで http://localhost:4000/graphql を開いて GraphQL Playground を使用できます。

## Directory Structure

各サンプルは以下の構造を持ちます:

```
examples/<example-name>/
├── package.json
├── tsconfig.json
├── server.ts                    # GraphQL サーバーエントリポイント
└── src/
    └── gql/
        ├── types/               # TypeScript 型定義
        └── resolvers/           # リゾルバ定義
```

`pnpm gen` を実行すると、`src/gqlkit/generated/` に以下が生成されます:

- `schema.ts` - GraphQL スキーマ AST（typeDefs）
- `resolvers.ts` - リゾルバマップ
