# Drizzle ORM

[Drizzle ORM](https://orm.drizzle.team/) is a TypeScript ORM with type-safe schema definitions. gqlkit integrates seamlessly with Drizzle by using `InferSelectModel` and `InferInsertModel` to derive GraphQL types from your table definitions.

## Installation

```sh filename="npm"
npm install drizzle-orm postgres
```

```sh filename="pnpm"
pnpm add drizzle-orm postgres
```

```sh filename="yarn"
yarn add drizzle-orm postgres
```

## Defining Tables

Define your database tables with Drizzle:

```typescript
// src/db/schema.ts
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial().primaryKey(),
  title: text().notNull(),
  content: text(),
  authorId: integer()
    .notNull()
    .references(() => users.id),
  createdAt: timestamp().notNull().defaultNow(),
});
```

## Defining Custom Scalars

Define custom scalar types using `GqlScalar` for fields like timestamps:

```typescript
// src/gqlkit/schema/scalars.ts
import type { GqlScalar } from "@gqlkit-ts/runtime";

export type DateTime = GqlScalar<"DateTime", Date>;
```

## Exporting GraphQL Types

Use Drizzle's type inference utilities to export GraphQL types from your table definitions:

```typescript
// src/gqlkit/schema/user.ts
import type { InferSelectModel } from "drizzle-orm";
import { users as usersTable } from "../../db/schema.js";

// Export as GraphQL object type
export type User = InferSelectModel<typeof usersTable>;
```

This generates the following GraphQL schema:

```graphql
type User {
  id: Float!
  name: String!
  email: String!
  createdAt: DateTime!
}
```

## Defining Resolvers

Define resolvers that use the derived types:

```typescript
// src/gqlkit/schema/user.ts
import type { NoArgs } from "@gqlkit-ts/runtime";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { posts as postsTable, users as usersTable } from "../../db/schema.js";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";
import type { Post } from "./post.js";

export type User = InferSelectModel<typeof usersTable>;

// Query resolvers
export const allUsers = defineQuery<NoArgs, User[]>(
  async (_root, _args, ctx) => {
    return ctx.db.select().from(usersTable);
  },
);

export const user = defineQuery<{ id: number }, User | null>(
  async (_root, args, ctx) => {
    const result = await ctx.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, args.id));
    return result[0] ?? null;
  },
);

// Mutation resolver with inline input type using InferInsertModel
// gqlkit auto-generates "CreateUserInput" from the field name
export const createUser = defineMutation<
  { input: Omit<InferInsertModel<typeof usersTable>, "id" | "createdAt"> },
  User
>(async (_root, args, ctx) => {
  const result = await ctx.db.insert(usersTable).values(args.input).returning();
  return result[0]!;
});

// Field resolver for relationships
export const posts = defineField<User, NoArgs, Post[]>(
  async (parent, _args, ctx) => {
    return ctx.db
      .select()
      .from(postsTable)
      .where(eq(postsTable.authorId, parent.id));
  },
);
```

## Context with Database

Set up the context type to include your database instance:

```typescript
// src/db/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema, casing: "snake_case" });
export type Database = typeof db;
```

```typescript
// src/gqlkit/context.ts
import type { Database } from "../db/db.js";

export type Context = {
  db: Database;
};
```

```typescript
// src/gqlkit/gqlkit.ts
import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { Context } from "./context.js";

export const { defineQuery, defineMutation, defineField } =
  createGqlkitApis<Context>();
```

## Complete Example

See the [examples/with-drizzle](https://github.com/gqlkit/gqlkit/tree/main/examples/with-drizzle) directory for a complete working example with:

- PostgreSQL tables with DateTime scalar
- User and Post types with relationships
- Query, Mutation, and Field resolvers

## Further Reading

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle with PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new)
