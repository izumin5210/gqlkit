import { fileURLToPath } from "node:url";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

function getDatabasePath(): string {
  const envPath = process.env["DATABASE_URL"];
  if (envPath) {
    return envPath;
  }

  return fileURLToPath(new URL("../../dev.db", import.meta.url));
}

const client = new BetterSqlite3(getDatabasePath());
client.pragma("foreign_keys = ON");
const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Database = typeof db;

export async function pushSchema(): Promise<void> {
  migrate(db, { migrationsFolder });
}

export function closeDatabase(): void {
  client.close();
}
