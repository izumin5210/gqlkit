# gqlkit

gqlkit is a convention-driven code generator for GraphQL servers in TypeScript.

You define GraphQL types and resolver signatures in TypeScript.
Then gqlkit gen generates GraphQL schema AST and a resolver map from your codebase.

## Quick start

Project layout:

```
src/
  gql/
    types/
    resolvers/
```

### 1. Define your GraphQL types in `src/gql/types`.

```ts
// src/gql/types/User.ts
import type { IDString } from "@gqlkit-ts/runtime";

export type User = {
  id: IDString;
  username: string;
};
```

### 2. Define resolver signatures and implementations in `src/gql/resolvers`.

```ts
// src/gql/resolvers/User.ts
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { User } from "../types/User";

type Context = { currentUserId: string };

const { defineQuery, defineField } = createGqlkitApis<Context>();

export const me = defineQuery<NoArgs, User>((_root, _args, ctx) => {
  return { id: ctx.currentUserId as IDString, username: "alice" };
});

export const profileUrl = defineField<User, NoArgs, string>((parent) => {
  return `https://example.com/users/${parent.username}`;
});
```

### 3. Generate schema wiring code.

`gqlkit gen`

### 4. Use the generated schema and resolvers in your runtime (example only).

```ts
// src/schema.ts (or wherever you want)
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./gqlkit/generated/schema";
import { resolvers } from "./gqlkit/generated/resolvers";

export const schema = makeExecutableSchema({ typeDefs, resolvers });
```

Generated outputs are:
- `typeDefs`: GraphQL schema AST (DocumentNode)
- `resolvers`: Resolver map object compatible with graphql-tools

## Conventions

gqlkit intentionally keeps conventions small and predictable.
If your code follows these conventions, schema generation is deterministic.

### 1) Source directories

- Types: `src/gql/types`
- Resolvers: `src/gql/resolvers`

Only exports from these directories are considered as gqlkit inputs.

### 2) Type definitions

Type definitions are plain TypeScript type (and optionally interface) exports.

- Each exported type is treated as a GraphQL type candidate (object/interface/union are supported depending on how gqlkit interprets the TS construct).
- Field nullability and list-ness are inferred from the TypeScript type surface (exact mapping rules are documented separately).

Example:

```ts
import type { IDString, Int } from "@gqlkit-ts/runtime";

export type Post = {
  id: IDString;
  title: string;
  viewCount: Int;
  author: User;
};
```

#### Branded scalar types

gqlkit provides branded types to explicitly specify GraphQL scalar mappings:

| TypeScript type | GraphQL type |
|-----------------|--------------|
| `IDString`      | `ID!`        |
| `IDNumber`      | `ID!`        |
| `Int`           | `Int!`       |
| `Float`         | `Float!`     |
| `string`        | `String!`    |
| `number`        | `Float!`     |
| `boolean`       | `Boolean!`   |

### 3) Resolver definitions

Resolvers are defined using the `@gqlkit-ts/runtime` API.

```ts
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = { userId: string };

const { defineQuery, defineMutation, defineField } = createGqlkitApis<Context>();
```

Each resolver export name becomes the GraphQL field name:

- `export const me = defineQuery<...>(...)` → `Query.me`
- `export const createUser = defineMutation<...>(...)` → `Mutation.createUser`
- `export const profileUrl = defineField<User, ...>(...)` → `User.profileUrl`

### 4) Resolver function signature rules

Resolver signatures must be explicit and type-checkable.

```ts
// Query/Mutation: (root, args, ctx, info) => Return
export const me = defineQuery<NoArgs, User>(
  (root, args, ctx, info) => { ... }
);

export const createUser = defineMutation<{ name: string }, User>(
  (root, args, ctx, info) => { ... }
);

// Field: (parent, args, ctx, info) => Return
export const profileUrl = defineField<User, NoArgs, string>(
  (parent, args, ctx, info) => { ... }
);
```

Type parameters:
- `defineQuery<TArgs, TResult>` - Query field resolver
- `defineMutation<TArgs, TResult>` - Mutation field resolver
- `defineField<TParent, TArgs, TResult>` - Object type field resolver

Use `NoArgs` type when the field has no arguments.

## `gqlkit gen`

`gqlkit gen` performs the following steps:

1. Scans `src/gql/types` and `src/gql/resolvers`
2. Builds an internal type graph from exported TypeScript types
3. Validates resolver signatures:
  - referenced parent/return types exist
  - resolver groups match known GraphQL roots/types
  - no extra fields / missing fields (depending on policy)
4. Generates:
  - GraphQL schema AST (DocumentNode) representing type definitions
  - GraphQL SDL file (optional)

Example generated output:

```ts
// src/gqlkit/generated/schema.ts
import type { DocumentNode } from "graphql";

export const typeDefs: DocumentNode = /* parsed schema AST */;
```

```graphql
# src/gqlkit/generated/schema.graphql
type Query {
  me: User!
}

type User {
  id: ID!
  username: String!
  profileUrl: String!
}
```

Output directory

By default:

- `src/gqlkit/generated/schema.ts` - TypeScript AST
- `src/gqlkit/generated/schema.graphql` - SDL file

(Keep generated code committed or not committed depending on your workflow; gqlkit should support both.)

## Configuration

gqlkit can be configured via `gqlkit.config.ts`:

```ts
// gqlkit.config.ts
import { defineConfig } from "@gqlkit-ts/cli";

export default defineConfig({
  scalars: [
    {
      graphqlName: "DateTime",
      type: { from: "./src/types/scalars", name: "DateTime" },
    },
  ],
  output: {
    ast: "src/gqlkit/generated/schema.ts",
    sdl: "src/gqlkit/generated/schema.graphql",
  },
});
```

### Custom scalar types

Map TypeScript types to GraphQL custom scalars:

```ts
export default defineConfig({
  scalars: [
    {
      graphqlName: "DateTime",
      type: { from: "./src/types/scalars", name: "DateTime" },
    },
    {
      graphqlName: "UUID",
      type: { from: "./src/types/scalars", name: "UUID" },
    },
  ],
});
```

### Output paths

Customize output file locations or disable outputs:

```ts
export default defineConfig({
  output: {
    ast: "generated/schema.ts",  // Custom path
    sdl: null,                    // Disable SDL output
  },
});
```

## Validation & errors (recommended behavior)

gqlkit should fail fast with actionable errors, e.g.

- Resolver refers to unknown type: `UserResolver.profileUrl` parent type User not found
- Resolver group mismatch: `UsersResolver` does not correspond to any known GraphQL type `User`s
- Type field unresolved: `Post.author` references User but User is missing
- Return type unsupported: `Map<string, string>` cannot be mapped to GraphQL

This is part of the “kit” value: consistent conventions + consistent diagnostics.

## Non-goals

- HTTP server integration (Apollo Server / Yoga / Helix) is intentionally out of scope for now.
- Runtime schema mutation / dynamic schema building is out of scope.
- Decorator-based metadata is out of scope.

gqlkit's focus is a deterministic, convention-driven path from TypeScript code to GraphQL schema AST and resolver maps.
