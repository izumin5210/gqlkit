import assert from "node:assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { runGenCommand } from "./gen.js";

describe("gen command", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "gqlkit-gen-test-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true });
  });

  async function setupProject(): Promise<void> {
    const typesDir = join(testDir, "src/gql/types");
    const resolversDir = join(testDir, "src/gql/resolvers");

    await mkdir(typesDir, { recursive: true });
    await mkdir(resolversDir, { recursive: true });

    await writeFile(
      join(typesDir, "user.ts"),
      "export interface User { id: string; name: string; }",
      "utf-8",
    );

    await writeFile(
      join(resolversDir, "query.ts"),
      `
        export type QueryResolver = {
          users: () => User[];
        };
        export const queryResolver: QueryResolver = {
          users: () => [],
        };
        interface User { id: string; name: string; }
      `,
      "utf-8",
    );
  }

  describe("successful generation", () => {
    it("should generate schema.ts file", async () => {
      await setupProject();

      const result = await runGenCommand({ cwd: testDir });

      assert.strictEqual(result.exitCode, 0);
      const schemaPath = join(testDir, "src/gqlkit/generated/schema.ts");
      const content = await readFile(schemaPath, "utf-8");
      assert.ok(content.includes("typeDefs"));
    });

    it("should generate resolvers.ts file", async () => {
      await setupProject();

      const result = await runGenCommand({ cwd: testDir });

      assert.strictEqual(result.exitCode, 0);
      const resolversPath = join(testDir, "src/gqlkit/generated/resolvers.ts");
      const content = await readFile(resolversPath, "utf-8");
      assert.ok(content.includes("resolvers"));
    });

    it("should return exit code 0 on success", async () => {
      await setupProject();

      const result = await runGenCommand({ cwd: testDir });

      assert.strictEqual(result.exitCode, 0);
    });
  });

  describe("error handling", () => {
    it("should return exit code 1 when types directory is missing", async () => {
      const resolversDir = join(testDir, "src/gql/resolvers");
      await mkdir(resolversDir, { recursive: true });

      const result = await runGenCommand({ cwd: testDir });

      assert.strictEqual(result.exitCode, 1);
    });

    it("should return exit code 1 when resolvers directory is missing", async () => {
      const typesDir = join(testDir, "src/gql/types");
      await mkdir(typesDir, { recursive: true });
      await writeFile(
        join(typesDir, "user.ts"),
        "export interface User { id: string; }",
        "utf-8",
      );

      const result = await runGenCommand({ cwd: testDir });

      assert.strictEqual(result.exitCode, 1);
    });
  });
});
