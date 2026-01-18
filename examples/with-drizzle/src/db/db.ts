import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema.js";

const client = new PGlite();
export const db = drizzle(client, { schema, casing: "snake_case" });
export type Database = typeof db;
