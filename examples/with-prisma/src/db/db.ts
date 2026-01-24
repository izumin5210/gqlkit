import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../__generated__/prisma/client.js";

function getDatabaseUrl(): string {
  const envUrl = process.env["DATABASE_URL"];
  if (envUrl) {
    return envUrl;
  }
  const testDbPath = join(tmpdir(), "gqlkit-prisma-test", "test.db");
  return `file:${testDbPath}`;
}

const dbUrl = getDatabaseUrl();
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
export const prisma = new PrismaClient({ adapter });
export type PrismaDatabase = typeof prisma;
