# gqlkit

gqlkit is a convention-driven code generator for GraphQL servers in TypeScript.

You define GraphQL types and resolver signatures in TypeScript.
Then `gqlkit gen` generates GraphQL schema AST and a resolver map from your codebase.

## Highlights

- **TypeScript-first** - Type-safe schema and resolvers in plain TypeScript, no decorators needed
- **Simple and minimal** - No DSL or complex generics; just types and functions; friendly for humans and AI
- **Convention over configuration** - Few rules, sensible defaults, works out of the box
- **Deterministic** - Same code always generates the same schema

## Getting started

### 1. Install dependencies

```bash
# Runtime dependencies
npm install @gqlkit-ts/runtime graphql @graphql-tools/schema

# Development dependency
npm install -D @gqlkit-ts/cli
```

### 2. Create types and resolvers

```ts
// src/gqlkit/schema/task.ts
import { createGqlkitApis, type IDString, type NoArgs } from "@gqlkit-ts/runtime";

const { defineQuery, defineMutation } = createGqlkitApis();

export type Task = {
  id: IDString;
  title: string;
  completed: boolean;
};

const tasksData: Task[] = [];
let nextId = 1;

export const tasks = defineQuery<NoArgs, Task[]>(() => tasksData);

export type CreateTaskInput = {
  title: string;
};

export const createTask = defineMutation<{ input: CreateTaskInput }, Task>(
  (_root, { input }) => {
    const task: Task = {
      id: String(nextId++) as Task["id"],
      title: input.title,
      completed: false,
    };
    tasksData.push(task);
    return task;
  }
);
```

### 3. Generate schema and resolvers

```bash
gqlkit gen
```

This generates:
- `src/gqlkit/__generated__/typeDefs.ts` - GraphQL schema AST
- `src/gqlkit/__generated__/resolvers.ts` - Resolver map
- `src/gqlkit/__generated__/schema.graphql` - SDL file

### 4. Create the executable schema

```ts
// src/schema.ts
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./gqlkit/__generated__/typeDefs.js";
import { resolvers } from "./gqlkit/__generated__/resolvers.js";

export const schema = makeExecutableSchema({ typeDefs, resolvers });
```

### 5. Start a GraphQL server (e.g., Yoga)

```bash
npm install graphql-yoga
```

```ts
// src/server.ts
import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema.js";

const yoga = createYoga({ schema });
const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Server running at http://localhost:4000/graphql");
});
```

Run the server and open http://localhost:4000/graphql to access GraphiQL:

```graphql
mutation {
  createTask(input: { title: "Learn gqlkit" }) {
    id
    title
    completed
  }
}

query {
  tasks_ {
    id
    title
    completed
  }
}
```

## Usage

Default project layout:

```
src/
  gqlkit/
    schema/        # Types and resolvers co-located
    __generated__/ # Generated files (auto-created)
```

### 1. Define types and resolvers together

```ts
// src/gqlkit/schema/user.ts
import { createGqlkitApis, type IDString, type Int, type NoArgs } from "@gqlkit-ts/runtime";

type Context = { currentUserId: string };

const { defineQuery, defineField } = createGqlkitApis<Context>();

/**
 * A user in the system
 */
export type User = {
  /** Unique identifier */
  id: IDString;
  /** Display name */
  name: string;
  /** Age in years */
  age: Int;
  /** Email address (null if not verified) */
  email: string | null;
};

export const me = defineQuery<NoArgs, User | null>((_root, _args, ctx) => {
  return findUserById(ctx.currentUserId);
});

/** Get user's profile URL */
export const profileUrl = defineField<User, NoArgs, string>((parent) => {
  return `https://example.com/users/${parent.id}`;
});
```

### 2. Generate schema and resolver wiring

```bash
gqlkit gen
```

### 3. Use the generated schema and resolvers

```ts
// src/schema.ts
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./gqlkit/__generated__/typeDefs";
import { resolvers } from "./gqlkit/__generated__/resolvers";

export const schema = makeExecutableSchema({ typeDefs, resolvers });
```

Generated outputs are:
- `typeDefs`: GraphQL schema AST (DocumentNode)
- `resolvers`: Resolver map object compatible with graphql-tools

## Features

### Built-in scalar types

gqlkit provides scalar types to explicitly specify GraphQL scalar mappings:

| TypeScript type | GraphQL type |
|-----------------|--------------|
| `IDString`      | `ID!`        |
| `IDNumber`      | `ID!`        |
| `Int`           | `Int!`       |
| `Float`         | `Float!`     |
| `string`        | `String!`    |
| `number`        | `Float!`     |
| `boolean`       | `Boolean!`   |

### Custom scalars with DefineScalar

Define custom scalar types using the `DefineScalar` utility type:

```ts
// src/gqlkit/schema/scalars.ts
import { DefineScalar } from "@gqlkit-ts/runtime";

/**
 * ISO 8601 format date-time string
 */
export type DateTime = DefineScalar<"DateTime", Date>;

// Input-only scalar (for input positions only)
export type DateTimeInput = DefineScalar<"DateTime", Date, "input">;

// Output-only scalar (for output positions only)
export type DateTimeOutput = DefineScalar<"DateTime", Date | string, "output">;
```

### TSDoc/JSDoc documentation

Type and field descriptions from TSDoc/JSDoc comments are automatically included in the generated GraphQL schema:

```ts
/**
 * A user in the system
 */
export type User = {
  /** Unique identifier */
  id: IDString;
  /** Display name */
  name: string;
};
```

Generates:

```graphql
"""
A user in the system

Defined in: src/gqlkit/schema/user.ts
"""
type User {
  """Unique identifier"""
  id: ID!
  """Display name"""
  name: String!
}
```

### @deprecated directive

Mark fields and enum values as deprecated using the `@deprecated` JSDoc tag:

```ts
export type User = {
  id: IDString;
  name: string;
  /**
   * Legacy username
   * @deprecated Use `name` field instead
   */
  username: string | null;
};

export enum UserStatus {
  Active = "ACTIVE",
  /**
   * @deprecated Use `Inactive` instead
   */
  Pending = "PENDING",
}
```

Generates:

```graphql
type User {
  id: ID!
  name: String!
  username: String @deprecated(reason: "Use `name` field instead")
}

enum UserStatus {
  ACTIVE
  PENDING @deprecated(reason: "Use `Inactive` instead")
}
```

### Enum types

TypeScript string enums are converted to GraphQL enum types:

```ts
/**
 * User account status
 */
export enum UserStatus {
  /** User is active */
  Active = "ACTIVE",
  /** User is inactive */
  Inactive = "INACTIVE",
}
```

### Union types

TypeScript union types are converted to GraphQL union types:

```ts
import type { Post } from "./Post";
import type { Comment } from "./Comment";

/**
 * Content that can be searched
 */
export type SearchResult = Post | Comment;
```

Generates:

```graphql
"""Content that can be searched"""
union SearchResult = Comment | Post
```

### Input object types

TypeScript interfaces/types with `Input` suffix are treated as GraphQL input types:

```ts
/** Input for creating a new user */
export interface CreateUserInput {
  name: string;
  email: string | null;
}
```

Generates:

```graphql
"""Input for creating a new user"""
input CreateUserInput {
  name: String!
  email: String
}
```

### @oneOf input objects

Union types with `Input` suffix generate `@oneOf` input objects:

```ts
/** Filter by ID */
export type ByIdInput = { id: string };

/** Filter by name */
export type ByNameInput = { name: string };

/**
 * Specifies how to identify a product.
 * Exactly one field must be provided.
 */
export type ProductInput = ByIdInput | ByNameInput;
```

Generates:

```graphql
input ProductInput @oneOf {
  """Filter by ID"""
  byIdInput: ByIdInput
  """Filter by name"""
  byNameInput: ByNameInput
}
```

### Field resolvers

Add computed fields to object types using `defineField`. Define them alongside the type:

```ts
// src/gqlkit/schema/user.ts
import { createGqlkitApis, type IDString, type NoArgs } from "@gqlkit-ts/runtime";
import type { Post } from "./post.js";

const { defineField } = createGqlkitApis<Context>();

export type User = {
  id: IDString;
  name: string;
};

/** Get posts authored by this user */
export const posts = defineField<User, NoArgs, Post[]>(
  (parent) => findPostsByAuthor(parent.id)
);

/** Get user's post count */
export const postCount = defineField<User, NoArgs, number>(
  (parent) => countPostsByAuthor(parent.id)
);
```

## Conventions

gqlkit intentionally keeps conventions small and predictable.
If your code follows these conventions, schema generation is deterministic.

### 1) Source directory

Default: `src/gqlkit/schema`

All TypeScript files (.ts, .cts, .mts) under this directory are scanned for types and resolvers.

### 2) Type definitions

Type definitions are plain TypeScript type (and optionally interface) exports.

- Each exported type is treated as a GraphQL type candidate (object/interface/union/enum are supported)
- Field nullability and list-ness are inferred from the TypeScript type surface
- TSDoc/JSDoc comments become GraphQL descriptions
- `@deprecated` tags generate `@deprecated` directives

### 3) Resolver definitions

Resolvers are defined using the `@gqlkit-ts/runtime` API:

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

1. Scans source directory for types and resolvers
2. Builds an internal type graph from exported TypeScript types
3. Validates resolver signatures:
   - referenced parent/return types exist
   - resolver groups match known GraphQL roots/types
4. Generates:
   - GraphQL schema AST (DocumentNode) representing type definitions
   - Resolver map aggregating all resolver implementations
   - GraphQL SDL file

Generated outputs (default paths):
- `src/gqlkit/__generated__/typeDefs.ts` - TypeScript schema AST
- `src/gqlkit/__generated__/resolvers.ts` - Resolver map
- `src/gqlkit/__generated__/schema.graphql` - SDL file

## Configuration

gqlkit can be configured via `gqlkit.config.ts`:

```ts
// gqlkit.config.ts
import { defineConfig } from "@gqlkit-ts/cli";

export default defineConfig({
  // Source directory (default: "src/gqlkit/schema")
  sourceDir: "src/gqlkit/schema",

  // Glob patterns to exclude from scanning
  sourceIgnoreGlobs: ["**/*.test.ts"],

  // Custom scalar mappings (config-based approach)
  scalars: [
    {
      name: "DateTime",
      tsType: { from: "./src/gqlkit/schema/scalars", name: "DateTime" },
      description: "ISO 8601 datetime",
    },
    {
      name: "UUID",
      tsType: { name: "string" },  // Global type
    },
  ],

  // Output paths
  output: {
    typeDefsPath: "src/gqlkit/__generated__/typeDefs.ts",
    resolversPath: "src/gqlkit/__generated__/resolvers.ts",
    schemaPath: "src/gqlkit/__generated__/schema.graphql",
    // Set to null to disable output:
    // schemaPath: null,
  },

  // Hooks
  hooks: {
    // Run after all files are written (e.g., formatting)
    afterAllFileWrite: "prettier --write",
    // Or multiple commands:
    // afterAllFileWrite: ["prettier --write", "eslint --fix"],
  },
});
```

### Custom scalar types (config-based)

Map TypeScript types to GraphQL custom scalars via config:

```ts
export default defineConfig({
  scalars: [
    {
      name: "DateTime",
      tsType: { from: "./src/gqlkit/schema/scalars", name: "DateTime" },
      description: "ISO 8601 datetime string",
    },
    {
      name: "UUID",
      tsType: { name: "string" },
      only: "input",  // Input-only scalar
    },
  ],
});
```

### Output paths

Customize output file locations or disable outputs:

```ts
export default defineConfig({
  output: {
    typeDefsPath: "generated/schema.ts",  // Custom path
    resolversPath: "generated/resolvers.ts",
    schemaPath: null,  // Disable SDL output
  },
});
```

### Hooks

Execute commands after file generation:

```ts
export default defineConfig({
  hooks: {
    // Single command
    afterAllFileWrite: "prettier --write",
    // Multiple commands (executed sequentially)
    afterAllFileWrite: ["prettier --write", "eslint --fix"],
  },
});
```

## Validation & errors

gqlkit fails fast with actionable errors:

- Resolver refers to unknown type: `UserResolver.profileUrl` parent type User not found
- Type field unresolved: `Post.author` references User but User is missing
- Return type unsupported: `Map<string, string>` cannot be mapped to GraphQL

## Non-goals

- Built-in HTTP server (gqlkit generates schema/resolvers; use any server like Yoga, Apollo, Helix)
- Runtime schema mutation / dynamic schema building
- Decorator-based metadata

gqlkit's focus is a deterministic, convention-driven path from TypeScript code to GraphQL schema AST and resolver maps.
