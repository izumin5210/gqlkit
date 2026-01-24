import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDbDir = join(tmpdir(), "gqlkit-prisma-test");
const testDbPath = join(testDbDir, "test.db");
const testDbUrl = `file:${testDbPath}`;

beforeAll(() => {
  mkdirSync(testDbDir, { recursive: true });

  if (existsSync(testDbPath)) {
    unlinkSync(testDbPath);
  }

  process.env["DATABASE_URL"] = testDbUrl;

  execFileSync("pnpm", ["prisma", "db", "push", "--accept-data-loss"], {
    cwd: __dirname,
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
});

afterAll(() => {
  try {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  } catch {
    // Ignore cleanup errors - file may already be deleted or locked
  }
});
