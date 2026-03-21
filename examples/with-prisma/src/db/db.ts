import { fileURLToPath } from "node:url";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../__generated__/prisma/client.js";

const defaultDatabaseUrl = `file:${fileURLToPath(
  new URL("../../dev.db", import.meta.url),
)}`;

function getDatabaseUrl(): string {
  const envUrl = process.env["DATABASE_URL"];
  if (envUrl) {
    return envUrl;
  }
  return defaultDatabaseUrl;
}

const dbUrl = getDatabaseUrl();
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
export const prisma = new PrismaClient({ adapter });
export type PrismaDatabase = typeof prisma;
