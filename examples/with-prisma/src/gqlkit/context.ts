import type { PrismaDatabase } from "../db/db.js";

export type Context = {
  db: PrismaDatabase;
};
