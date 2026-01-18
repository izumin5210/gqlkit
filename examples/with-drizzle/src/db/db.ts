import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import type * as DrizzleKit from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema.js";

const require = createRequire(import.meta.url);
const { generateDrizzleJson, generateMigration } =
  require("drizzle-kit/api") as typeof DrizzleKit;

const client = new PGlite();
export const db = drizzle(client, { schema, casing: "snake_case" });
export type Database = typeof db;

export async function pushSchema(): Promise<void> {
  const prevJson = generateDrizzleJson({});
  const curJson = generateDrizzleJson(
    schema,
    prevJson.id,
    undefined,
    "snake_case"
  );
  const statements = await generateMigration(prevJson, curJson);
  for (const statement of statements) {
    await db.execute(statement);
  }
}
