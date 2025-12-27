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
export type User = {
  id: string
  username: string
}
```

### 2. Define resolver signatures and implementations in `src/gql/resolvers`.

```ts
// src/gql/resolvers/User.ts
import { User } from "../types/User";

export type QueryResolver = {
  me: () => User;
};

export type UserResolver = {
  profileUrl: (user: User) => string
};

export const queryResolver: QueryResolver = {
  me() {
    return { id: "1", username: "alice" };
  },
};

export const userResolver: UserResolver = {
  profileUrl(user) {
    return `https://example.com/users/${user.username}`;
  },
};
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
export type Post = {
  id: string
  title: string
  author: User
}
```

### 3) Resolver files define “resolver groups”

Resolvers are discovered by exported resolver type aliases and exported resolver values.

In each resolver module:

- You define a resolver signature type, e.g. `export type UserResolver = { ... }`
- You export an implementation object that matches it, e.g. `export const userResolver: UserResolver = { ... }`

Resolver groups are matched by name:

- `QueryResolver` → GraphQL Query
- `MutationResolver` → GraphQL Mutation
- `<TypeName>Resolver` → GraphQL object type `<TypeName>`

So in the example above:

- `QueryResolver` maps to `Query`
- `UserResolver` maps to `User`

### 4) Resolver function signature rules

Resolver signatures must be explicit and type-checkable.

Supported minimal signatures:

- Root fields (Query/Mutation):
    - `field: () => Return`
    - (optionally later) `field: (args: Args, ctx: Context, info: GraphQLResolveInfo) => Return`
- Object fields:
    - field: `(parent: Parent) => Return`
    - (optionally later) `field: (parent: Parent, args: Args, ctx: Context, info: GraphQLResolveInfo) => Return`

In your current design, `UserResolver.profileUrl` is:

```
profileUrl: (user: User) => string
```

This implies:

- parent type = `User`
- return type = `String!` (depending on nullability rules)

### 5) Naming conventions for exported resolver values

To keep generation simple and avoid configuration:
- Resolver implementation exports should be named:
    - `queryResolver` for `QueryResolver`
    - `mutationResolver` for `MutationResolver`
    - `userResolver` for `UserResolver` (lower camel case of type name)

This is the recommended convention because it enables a strict 1:1 mapping without additional metadata.

(If you want flexibility later, you can add an escape hatch via a small config file, but the default path should remain convention-driven.)

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
  - Resolver map object aggregating all resolver implementations

Example generated output (illustrative):

```ts
// src/gqlkit/generated/schema.ts
import type { DocumentNode } from "graphql";

export const typeDefs: DocumentNode = /* parsed schema AST */;
```

```ts
// src/gqlkit/generated/resolvers.ts
export const resolvers = {
  Query: {
    me: queryResolver.me,
  },
  User: {
    profileUrl: userResolver.profileUrl,
  },
};
```

Output directory

By default:

- `src/gqlkit/generated/**`

(Keep generated code committed or not committed depending on your workflow; gqlkit should support both.)

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
