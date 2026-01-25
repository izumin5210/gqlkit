# Prisma

[Prisma](https://www.prisma.io/) is a next-generation ORM for Node.js and TypeScript. gqlkit integrates seamlessly with Prisma by using its generated model types to derive GraphQL types from your schema definitions.

## Installation

```sh filename="npm"
npm install prisma @prisma/client
```

```sh filename="pnpm"
pnpm add prisma @prisma/client
```

```sh filename="yarn"
yarn add prisma @prisma/client
```

## Defining the Schema

Define your database schema in `prisma/schema.prisma`:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/__generated__/prisma"
}

datasource db {
  provider = "sqlite"
}

enum UserStatus {
  active
  inactive
  suspended
}

model User {
  id        String     @id @default(uuid())
  name      String
  email     String     @unique
  status    UserStatus @default(active)
  createdAt DateTime   @default(now()) @map("created_at")
  posts     Post[]

  @@map("users")
}

enum PostPriority {
  low
  medium
  high
}

model Post {
  id        String       @id @default(uuid())
  title     String
  content   String?
  priority  PostPriority @default(medium)
  authorId  String       @map("author_id")
  createdAt DateTime     @default(now()) @map("created_at")
  author    User         @relation(fields: [authorId], references: [id])

  @@map("posts")
}
```

Enum types defined in the Prisma schema are automatically converted to corresponding GraphQL enum types by gqlkit.

## Defining Custom Scalars

Define custom scalar types using `GqlScalar` for fields like timestamps:

```typescript
// src/gqlkit/schema/scalars.ts
import type { GqlScalar } from "@gqlkit-ts/runtime";

export type DateTime = GqlScalar<"DateTime", Date>;
```

## Exporting GraphQL Types

Use Prisma's generated model types to export GraphQL types from your schema definitions:

```typescript
// src/gqlkit/schema/user.ts
import type { Prisma } from "../../__generated__/prisma/client.js";

// Export as GraphQL object type
export type User = Prisma.UserModel;
```

This generates the following GraphQL schema:

```graphql
enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

type User {
  id: String!
  name: String!
  email: String!
  status: UserStatus!
  createdAt: DateTime!
}
```

## Defining Resolvers

Define resolvers that use the derived types:

```typescript
// src/gqlkit/schema/user.ts
import type { NoArgs } from "@gqlkit-ts/runtime";
import type { Prisma } from "../../__generated__/prisma/client.js";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";
import type { Post } from "./post.js";

export type User = Prisma.UserModel;

export const allUsers = defineQuery<NoArgs, User[]>(
  async (_root, _args, ctx) => {
    return ctx.db.user.findMany();
  },
);

export const user = defineQuery<{ id: string }, User | null>(
  async (_root, args, ctx) => {
    return ctx.db.user.findUnique({
      where: { id: args.id },
    });
  },
);

export const createUser = defineMutation<
  { input: Omit<Prisma.UserCreateInput, "id" | "createdAt" | "posts"> },
  User
>(async (_root, args, ctx) => {
  return ctx.db.user.create({
    data: args.input,
  });
});

export const posts = defineField<User, NoArgs, Post[]>(
  async (parent, _args, ctx) => {
    return ctx.db.post.findMany({
      where: { authorId: parent.id },
    });
  },
);
```

## Context with Database

Set up the context type to include your Prisma client instance. For basic setup, see [Set Up Context and Resolver Factories](../getting-started.md#set-up-context-and-resolver-factories).

```typescript
// src/db/db.ts
import { PrismaClient } from "../__generated__/prisma/client.js";

export const prisma = new PrismaClient();
export type PrismaDatabase = typeof prisma;
```

```typescript
// src/gqlkit/context.ts
import type { PrismaDatabase } from "../db/db.js";

export type Context = {
  db: PrismaDatabase;
};
```

## Complete Example

See the [examples/with-prisma](https://github.com/gqlkit/gqlkit/tree/main/examples/with-prisma) directory for a complete working example with:

- SQLite database with DateTime scalar
- Enum types (`UserStatus`, `PostPriority`)
- User and Post types with relationships
- Query, Mutation, and Field resolvers

## Further Reading

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Client API Reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference)
