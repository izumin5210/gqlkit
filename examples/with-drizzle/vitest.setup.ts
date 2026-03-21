import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDbDir = join(tmpdir(), "gqlkit-drizzle-test");
const testDbPath = join(testDbDir, "test.db");

mkdirSync(testDbDir, { recursive: true });

if (existsSync(testDbPath)) {
  unlinkSync(testDbPath);
}

process.env["DATABASE_URL"] = testDbPath;

afterAll(async () => {
  try {
    const { closeDatabase } = await import("./src/db/db.js");
    closeDatabase();
  } catch {
    // Ignore cleanup errors if the database was never initialized.
  }

  try {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  } catch {
    // Ignore cleanup errors - file may already be deleted or locked.
  }
});
