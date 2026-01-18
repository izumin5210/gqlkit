# Drizzle ORM

[Drizzle ORM](https://orm.drizzle.team/) is a TypeScript ORM with type-safe schema definitions. gqlkit integrates seamlessly with Drizzle by using `InferSelectModel` and `InferInsertModel` to derive GraphQL types from your table definitions.

## Installation

```sh filename="npm"
npm install drizzle-orm
```

```sh filename="pnpm"
pnpm add drizzle-orm
```

```sh filename="yarn"
yarn add drizzle-orm
```

## Defining Tables with Custom Scalars

Define your database tables with Drizzle. You can use `GqlScalar` to create custom scalar types that map to GraphQL:

```typescript
// src/db/schema.ts
import type { GqlScalar } from "@gqlkit-ts/runtime";
import { customType, pgTable, serial, text } from "drizzle-orm/pg-core";

// Define a custom DateTime scalar
export type DateTime = GqlScalar<"DateTime", Date>;

const dateTime = customType<{ data: DateTime; driverData: Date }>({
  dataType() {
    return "timestamp";
  },
  fromDriver(value: Date): DateTime {
    return value as DateTime;
  },
  toDriver(value: DateTime): Date {
    return value;
  },
});

// Define your tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: dateTime("created_at").notNull().default(new Date()),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  createdAt: dateTime("created_at").notNull().default(new Date()),
});
```

## Exporting GraphQL Types

Use Drizzle's type inference utilities to export GraphQL types from your table definitions:

```typescript
// src/gqlkit/schema/user.ts
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { users as usersTable } from "../../db/schema.js";

// Export as GraphQL object type
export type User = InferSelectModel<typeof usersTable>;

// Export as GraphQL input type (exclude auto-generated fields)
export type CreateUserInput = Omit<
  InferInsertModel<typeof usersTable>,
  "id" | "createdAt"
>;
```

This generates the following GraphQL schema:

```graphql
type User {
  id: Float!
  name: String!
  email: String!
  createdAt: DateTime!
}

input CreateUserInput {
  name: String!
  email: String!
}
```

## Defining Resolvers

Define resolvers that use the derived types:

```typescript
// src/gqlkit/schema/user.ts
import type { NoArgs } from "@gqlkit-ts/runtime";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { users as usersTable } from "../../db/schema.js";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";
import type { Post } from "./post.js";

export type User = InferSelectModel<typeof usersTable>;
export type CreateUserInput = Omit<
  InferInsertModel<typeof usersTable>,
  "id" | "createdAt"
>;

// Query resolvers
export const allUsers = defineQuery<NoArgs, User[]>(
  async (_root, _args, ctx) => {
    return ctx.db.select().from(usersTable);
  }
);

export const user = defineQuery<{ id: number }, User | null>(
  async (_root, args, ctx) => {
    const result = await ctx.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, args.id));
    return result[0] ?? null;
  }
);

// Mutation resolver
export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  async (_root, args, ctx) => {
    const result = await ctx.db
      .insert(usersTable)
      .values({
        name: args.input.name,
        email: args.input.email,
      })
      .returning();
    return result[0]!;
  }
);

// Field resolver for relationships
export const posts = defineField<User, NoArgs, Post[]>(
  async (parent, _args, ctx) => {
    return ctx.db
      .select()
      .from(postsTable)
      .where(eq(postsTable.authorId, parent.id));
  }
);
```

## Context with Database

Set up the context type to include your database instance:

```typescript
// src/gqlkit/context.ts
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "../db/schema.js";

export type Context = {
  db: PgliteDatabase<typeof schema>;
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

See the [examples/drizzle](https://github.com/gqlkit/gqlkit/tree/main/examples/drizzle) directory for a complete working example with:

- PostgreSQL tables with custom DateTime scalar
- User and Post types with relationships
- Query, Mutation, and Field resolvers
- PGlite for in-memory PostgreSQL (no external database required)

## Further Reading

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle with PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new)
- [PGlite](https://pglite.dev/) - In-memory PostgreSQL for development
