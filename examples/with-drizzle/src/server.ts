import { createServer } from "node:http";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { sql } from "drizzle-orm";
import { GraphQLDateTime } from "graphql-scalars";
import { createYoga } from "graphql-yoga";
import { db } from "./db/db.js";
import { createResolvers } from "./gqlkit/__generated__/resolvers.js";
import { typeDefs } from "./gqlkit/__generated__/typeDefs.js";
import type { Context } from "./gqlkit/context.js";

async function initializeDatabase() {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE post_status AS ENUM ('draft', 'published', 'archived');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      status user_status NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      status post_status NOT NULL DEFAULT 'draft',
      author_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function main() {
  await initializeDatabase();

  const resolvers = createResolvers({
    scalars: {
      DateTime: GraphQLDateTime,
    },
  });
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const yoga = createYoga<object, Context>({
    schema,
    context: () => ({ db }),
  });

  const server = createServer(yoga);

  server.listen(4000, () => {
    console.log("Server is running on http://localhost:4000/graphql");
  });
}

main().catch(console.error);
