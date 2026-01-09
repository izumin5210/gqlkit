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

### Custom directives

Define custom directives using the `Directive` utility type and attach them using `GqlFieldDef` or `GqlTypeDef`:

#### Defining directives

```ts
// src/gqlkit/schema/directives.ts
import { type Directive } from "@gqlkit-ts/runtime";

export type Role = "USER" | "ADMIN";

// Directive with typed arguments
export type AuthDirective<TArgs extends { role: Role[] }> = Directive<
  "auth",
  TArgs,
  "FIELD_DEFINITION"
>;

// Directive with multiple locations
export type CacheDirective<TArgs extends { maxAge: number }> = Directive<
  "cache",
  TArgs,
  ["FIELD_DEFINITION", "OBJECT"]
>;
```

Generates:

```graphql
directive @auth(role: [Role!]!) on FIELD_DEFINITION
directive @cache(maxAge: Float!) on FIELD_DEFINITION | OBJECT
```

#### Attaching directives to fields

Use `GqlFieldDef` to attach directives to object type fields:

```ts
import { type GqlFieldDef, type IDString } from "@gqlkit-ts/runtime";
import { type AuthDirective, type Role } from "./directives.js";

export type User = {
  id: IDString;
  name: string;
  // Field with directive
  email: GqlFieldDef<string, { directives: [AuthDirective<{ role: ["ADMIN"] }>] }>;
  // Nullable field with directive
  phone: GqlFieldDef<string | null, { directives: [AuthDirective<{ role: ["USER"] }>] }>;
};
```

Generates:

```graphql
type User {
  id: ID!
  name: String!
  email: String! @auth(role: [ADMIN])
  phone: String @auth(role: [USER])
}
```

#### Attaching directives to types

Use `GqlTypeDef` to attach directives to type definitions:

```ts
import { type GqlTypeDef, type IDString } from "@gqlkit-ts/runtime";
import { type CacheDirective } from "./directives.js";

export type Post = GqlTypeDef<
  {
    id: IDString;
    title: string;
  },
  { directives: [CacheDirective<{ maxAge: 60 }>] }
>;
```

Generates:

```graphql
type Post @cache(maxAge: 60) {
  id: ID!
  title: String!
}
```

#### Attaching directives to Query/Mutation fields

Add a third type parameter to `defineQuery`, `defineMutation`, or `defineField`:

```ts
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import { type AuthDirective } from "./directives.js";
import type { User } from "./user.js";

const { defineQuery } = createGqlkitApis<Context>();

// Query field with directive
export const me = defineQuery<
  NoArgs,
  User,
  [AuthDirective<{ role: ["USER"] }>]
>((_root, _args, ctx) => ctx.currentUser);
```

Generates:

```graphql
type Query {
  me: User! @auth(role: [USER])
}
```

### Object types

Plain TypeScript type exports become GraphQL Object types. See the examples in "Define types and resolvers together" section above.

#### Inline objects in Object types

Object type fields can use inline object literals for nested structures. gqlkit automatically generates Object types with the naming convention `{ParentTypeName}{PascalCaseFieldName}`:

```ts
export type User = {
  id: string;
  name: string;
  /** User's profile information */
  profile: {
    /** User's biography */
    bio: string;
    age: number;
  };
};
```

Generates:

```graphql
type User {
  id: String!
  name: String!
  """User's profile information"""
  profile: UserProfile!
}

type UserProfile {
  """User's biography"""
  bio: String!
  age: Float!
}
```

Nested inline objects generate types with concatenated names (e.g., `User.profile.address` → `UserProfileAddress`).

### Enum types

String literal unions are converted to GraphQL enum types:

```ts
/**
 * User account status
 */
export type UserStatus = "ACTIVE" | "INACTIVE";
```

TypeScript string enums are also supported:

```ts
export enum UserStatus {
  Active = "ACTIVE",
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

### Interface types

Define GraphQL interface types using the `DefineInterface` utility type:

```ts
// src/gqlkit/schema/node.ts
import { type DefineInterface, type IDString } from "@gqlkit-ts/runtime";
import type { DateTime } from "./scalars.js";

/**
 * Node interface - represents any entity with a unique identifier.
 */
export type Node = DefineInterface<{
  /** Global unique identifier */
  id: IDString;
}>;

/**
 * Timestamped interface - entities that track creation time.
 */
export type Timestamped = DefineInterface<{
  createdAt: DateTime;
}>;
```

Generates:

```graphql
"""Node interface - represents any entity with a unique identifier."""
interface Node {
  """Global unique identifier"""
  id: ID!
}

"""Timestamped interface - entities that track creation time."""
interface Timestamped {
  createdAt: DateTime!
}
```

#### Interface inheritance

Interfaces can inherit from other interfaces:

```ts
/**
 * Entity interface - combines Node and Timestamped.
 */
export type Entity = DefineInterface<
  {
    id: IDString;
    createdAt: DateTime;
  },
  { implements: [Node, Timestamped] }
>;
```

Generates:

```graphql
"""Entity interface - combines Node and Timestamped."""
interface Entity implements Node & Timestamped {
  id: ID!
  createdAt: DateTime!
}
```

#### Implementing interfaces

Use `GqlTypeDef` with the `implements` option to declare that a type implements interfaces:

```ts
import { type GqlTypeDef, type IDString } from "@gqlkit-ts/runtime";
import type { Node, Timestamped } from "./node.js";
import type { DateTime } from "./scalars.js";

/**
 * A user in the system.
 */
export type User = GqlTypeDef<
  {
    id: IDString;
    name: string;
    email: string | null;
    createdAt: DateTime;
  },
  { implements: [Node, Timestamped] }
>;
```

Generates:

```graphql
"""A user in the system."""
type User implements Node & Timestamped {
  id: ID!
  name: String!
  email: String
  createdAt: DateTime!
}
```

You can combine `implements` with `directives`:

```ts
export type Post = GqlTypeDef<
  {
    id: IDString;
    title: string;
    createdAt: DateTime;
  },
  {
    implements: [Node, Timestamped],
    directives: [CacheDirective<{ maxAge: 60 }>]
  }
>;
```

#### Interface field resolvers

Add computed fields to interface types using `defineField`:

```ts
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

const { defineField } = createGqlkitApis<Context>();

/** Get the typename of a Node */
export const __typename = defineField<Node, NoArgs, string>(
  (parent) => parent.constructor.name
);
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

#### Inline objects in Input types

Input types can use inline object literals for nested structures. gqlkit automatically generates Input Object types with the naming convention `{ParentTypeNameWithoutInputSuffix}{PascalCaseFieldName}Input`:

```ts
import type { GqlFieldDef, Int } from "@gqlkit-ts/runtime";

export type CreateUserInput = {
  name: string;
  /** Profile information */
  profile: {
    bio: string | null;
    /** User's age with default value */
    age: GqlFieldDef<Int | null, { defaultValue: 18 }>;
  };
};
```

Generates:

```graphql
input CreateUserInput {
  name: String!
  """Profile information"""
  profile: CreateUserProfileInput!
}

input CreateUserProfileInput {
  """User's age with default value"""
  age: Int = 18
  bio: String
}
```

Nested inline objects generate types with concatenated names (e.g., `UserProfileInput.address` → `UserProfileAddressInput`).

### @oneOf input objects

Union types with `Input` suffix using inline object literals generate `@oneOf` input objects. Each union member must be an inline object literal with exactly one property. Property values can be scalar types, enum types, or references to Input Object types:

```ts
/**
 * Specifies how to identify a product.
 * Exactly one field must be provided.
 */
export type ProductInput =
  | { id: string }
  | { name: string }
  | { location: LocationInput };
```

Generates:

```graphql
"""
Specifies how to identify a product.
Exactly one field must be provided.
"""
input ProductInput @oneOf {
  id: String
  location: LocationInput
  name: String
}
```

Each property becomes a nullable field in the generated input type. The `@oneOf` directive ensures exactly one field is provided at runtime.

### Default values for input fields and arguments

Specify default values for Input Object fields and resolver arguments using `GqlFieldDef` with the `defaultValue` option:

#### Basic default values

```ts
import { type GqlFieldDef, type Int } from "@gqlkit-ts/runtime";

export type PaginationInput = {
  limit: GqlFieldDef<Int, { defaultValue: 10 }>;
  offset: GqlFieldDef<Int, { defaultValue: 0 }>;
  includeArchived: GqlFieldDef<boolean, { defaultValue: false }>;
};

export type SearchInput = {
  query: string;
  caseSensitive: GqlFieldDef<boolean, { defaultValue: true }>;
  maxResults: GqlFieldDef<Int | null, { defaultValue: null }>;
};

export type GreetingInput = {
  name: GqlFieldDef<string, { defaultValue: "World" }>;
  prefix: GqlFieldDef<string, { defaultValue: "Hello" }>;
};
```

Generates:

```graphql
input PaginationInput {
  limit: Int! = 10
  offset: Int! = 0
  includeArchived: Boolean! = false
}

input SearchInput {
  query: String!
  caseSensitive: Boolean! = true
  maxResults: Int = null
}

input GreetingInput {
  name: String! = "World"
  prefix: String! = "Hello"
}
```

#### Complex default values

Default values support arrays, objects, and enum values:

```ts
export type Status = "ACTIVE" | "INACTIVE" | "PENDING";

export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type NestedConfig = {
  enabled: boolean;
  value: Int;
};

export type FilterInput = {
  status: GqlFieldDef<Status, { defaultValue: "ACTIVE" }>;
  priorities: GqlFieldDef<Priority[], { defaultValue: ["MEDIUM", "HIGH"] }>;
  tags: GqlFieldDef<string[], { defaultValue: ["default"] }>;
};

export type SettingsInput = {
  config: GqlFieldDef<NestedConfig, { defaultValue: { enabled: true; value: 100 } }>;
  limits: GqlFieldDef<Int[], { defaultValue: [10, 20, 30] }>;
};
```

Generates:

```graphql
input FilterInput {
  status: Status! = ACTIVE
  priorities: [Priority!]! = [MEDIUM, HIGH]
  tags: [String!]! = ["default"]
}

input SettingsInput {
  config: NestedConfig! = {enabled: true, value: 100}
  limits: [Int!]! = [10, 20, 30]
}
```

#### Default values with directives

You can combine `defaultValue` with `directives`:

```ts
import { type GqlFieldDef, type Directive, type Int } from "@gqlkit-ts/runtime";

export type LengthDirective<TArgs extends { min: number; max: number }> =
  Directive<"length", TArgs, "INPUT_FIELD_DEFINITION" | "ARGUMENT_DEFINITION">;

export type RangeDirective<TArgs extends { min: number; max: number }> =
  Directive<"range", TArgs, "INPUT_FIELD_DEFINITION" | "ARGUMENT_DEFINITION">;

export type CreateUserInput = {
  name: GqlFieldDef<string, {
    defaultValue: "Anonymous";
    directives: [LengthDirective<{ min: 1; max: 100 }>];
  }>;
  age: GqlFieldDef<Int, {
    defaultValue: 18;
    directives: [RangeDirective<{ min: 0; max: 150 }>];
  }>;
  email: GqlFieldDef<string | null, {
    defaultValue: null;
    directives: [LengthDirective<{ min: 5; max: 255 }>];
  }>;
};
```

Generates:

```graphql
input CreateUserInput {
  name: String! = "Anonymous" @length(min: 1, max: 100)
  age: Int! = 18 @range(min: 0, max: 150)
  email: String = null @length(min: 5, max: 255)
}
```

#### Default values in resolver arguments

Default values in Input Objects are also applied to resolver arguments:

```ts
import { createGqlkitApis, type GqlFieldDef, type Int } from "@gqlkit-ts/runtime";

const { defineQuery } = createGqlkitApis();

export type PaginationInput = {
  limit: GqlFieldDef<Int, { defaultValue: 10 }>;
  offset: GqlFieldDef<Int, { defaultValue: 0 }>;
};

export type User = {
  id: string;
  name: string;
};

export const users = defineQuery<PaginationInput, User[]>(() => []);
```

Generates:

```graphql
type Query {
  users(limit: Int! = 10, offset: Int! = 0): [User!]!
}
```

#### Supported default value types

| Value type | Example | GraphQL output |
|------------|---------|----------------|
| String | `"hello"` | `"hello"` |
| Number (Int) | `10` | `10` |
| Number (Float) | `3.14` | `3.14` |
| Boolean | `true`, `false` | `true`, `false` |
| Null | `null` | `null` |
| Array | `[1, 2, 3]` | `[1, 2, 3]` |
| Object | `{ key: "value" }` | `{key: "value"}` |
| Enum | `"ACTIVE"` (when field type is enum) | `ACTIVE` |

#### Important: Literal types required

Default values must be specified as TypeScript literal types. Non-literal types will cause a warning:

```ts
// ✅ OK: Literal types
export type GoodInput = {
  limit: GqlFieldDef<Int, { defaultValue: 10 }>;
  name: GqlFieldDef<string, { defaultValue: "default" }>;
};

// ❌ Error: Non-literal types
export type BadInput = {
  limit: GqlFieldDef<Int, { defaultValue: number }>;     // Warning: must be literal
  name: GqlFieldDef<string, { defaultValue: string }>;   // Warning: must be literal
};
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

#### Inline objects in resolver arguments

Resolver arguments can use inline object literals. gqlkit automatically generates Input Object types:

- **Query/Mutation arguments**: `{PascalCaseFieldName}{PascalCaseArgName}Input`
- **Field resolver arguments**: `{ParentTypeName}{PascalCaseFieldName}{PascalCaseArgName}Input`

```ts
import { createGqlkitApis, type GqlFieldDef } from "@gqlkit-ts/runtime";

const { defineQuery, defineField } = createGqlkitApis<Context>();

export const searchUsers = defineQuery<
  {
    /** Search filter */
    filter: {
      namePattern: string | null;
    };
  },
  User[]
>((_root, args) => []);

export const posts = defineField<
  User,
  {
    /** Filter options */
    filter: {
      titlePattern: string | null;
    } | null;
  },
  Post[]
>((parent, args) => []);
```

Generates:

```graphql
type Query {
  searchUsers(
    """Search filter"""
    filter: SearchUsersFilterInput!
  ): [User!]!
}

type User {
  posts(
    """Filter options"""
    filter: UserPostsFilterInput
  ): [Post!]!
}

input SearchUsersFilterInput {
  namePattern: String
}

input UserPostsFilterInput {
  titlePattern: String
}
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
