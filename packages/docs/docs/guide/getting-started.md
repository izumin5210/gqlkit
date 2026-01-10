# Getting Started

## Installation

::: code-group

```sh [npm]
npm install @gqlkit-ts/cli @gqlkit-ts/runtime
```

```sh [pnpm]
pnpm add @gqlkit-ts/cli @gqlkit-ts/runtime
```

```sh [yarn]
yarn add @gqlkit-ts/cli @gqlkit-ts/runtime
```

:::

## Project Structure

gqlkit expects your types and resolvers to be in `src/gqlkit/schema/`:

```
src/
└── gqlkit/
    └── schema/
        ├── user.ts      # User type and resolvers
        ├── post.ts      # Post type and resolvers
        └── query.ts     # Query resolvers
```

## Define Your First Type

Create a simple User type in `src/gqlkit/schema/user.ts`:

```typescript
export type User = {
  id: string;
  name: string;
  email: string | null;
};
```

## Generate Schema

Run the generator:

```sh
npx gqlkit gen
```

This will create files in `src/gqlkit/__generated__/`:
- `schema.ts` - GraphQL schema AST (DocumentNode)
- `resolvers.ts` - Resolver map
