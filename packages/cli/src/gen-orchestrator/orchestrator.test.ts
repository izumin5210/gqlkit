import assert from "node:assert";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { executeGeneration, type GenerationConfig } from "./orchestrator.js";

describe("GenCommandOrchestrator", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "gqlkit-orchestrator-test-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true });
  });

  async function setupTypesDir(types: Record<string, string>): Promise<string> {
    const typesDir = join(testDir, "src/gql/types");
    await mkdir(typesDir, { recursive: true });
    for (const [filename, content] of Object.entries(types)) {
      await writeFile(join(typesDir, filename), content, "utf-8");
    }
    return typesDir;
  }

  async function setupResolversDir(
    resolvers: Record<string, string>,
  ): Promise<string> {
    const resolversDir = join(testDir, "src/gql/resolvers");
    await mkdir(resolversDir, { recursive: true });
    for (const [filename, content] of Object.entries(resolvers)) {
      await writeFile(join(resolversDir, filename), content, "utf-8");
    }
    return resolversDir;
  }

  describe("directory scanning (Task 4.1)", () => {
    it("should return error when types directory does not exist", async () => {
      const config: GenerationConfig = {
        cwd: testDir,
        typesDir: join(testDir, "nonexistent/types"),
        resolversDir: join(testDir, "nonexistent/resolvers"),
        outputDir: join(testDir, "generated"),
      };

      const result = await executeGeneration(config);

      assert.strictEqual(result.success, false);
      assert.ok(
        result.diagnostics.some((d) => d.code === "DIRECTORY_NOT_FOUND"),
      );
    });

    it("should return error when resolvers directory does not exist", async () => {
      await setupTypesDir({
        "user.ts": "export interface User { id: string; }",
      });

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir: join(testDir, "src/gql/types"),
        resolversDir: join(testDir, "nonexistent/resolvers"),
        outputDir: join(testDir, "generated"),
      };

      const result = await executeGeneration(config);

      assert.strictEqual(result.success, false);
      assert.ok(
        result.diagnostics.some((d) => d.code === "DIRECTORY_NOT_FOUND"),
      );
    });
  });

  describe("type and resolver extraction (Task 4.2)", () => {
    it("should extract types from types directory", async () => {
      await setupTypesDir({
        "user.ts": "export interface User { id: string; name: string; }",
      });
      await setupResolversDir({
        "query.ts": `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; name: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const users = defineQuery<NoArgs, User[]>(function() { return []; });
        `,
      });

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir: join(testDir, "src/gql/types"),
        resolversDir: join(testDir, "src/gql/resolvers"),
        outputDir: join(testDir, "generated"),
      };

      const result = await executeGeneration(config);

      assert.strictEqual(result.success, true);
      assert.ok(result.filesWritten.length > 0);
    });

    it("should collect diagnostics from extraction", async () => {
      await setupTypesDir({
        "user.ts": "export interface User { id: unknown; }",
      });
      await setupResolversDir({
        "query.ts": `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<NoArgs, User>(function() { return {} as User; });
        `,
      });

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir: join(testDir, "src/gql/types"),
        resolversDir: join(testDir, "src/gql/resolvers"),
        outputDir: join(testDir, "generated"),
      };

      const result = await executeGeneration(config);

      assert.ok(result.diagnostics.length > 0);
    });
  });

  describe("schema generation (Task 4.3)", () => {
    it("should generate schema.ts and resolvers.ts", async () => {
      await setupTypesDir({
        "user.ts": "export interface User { id: string; name: string; }",
      });
      await setupResolversDir({
        "query.ts": `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; name: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const users = defineQuery<NoArgs, User[]>(function() { return []; });
        `,
      });

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir: join(testDir, "src/gql/types"),
        resolversDir: join(testDir, "src/gql/resolvers"),
        outputDir: join(testDir, "generated"),
      };

      const result = await executeGeneration(config);

      assert.strictEqual(result.success, true);
      assert.ok(result.filesWritten.some((f) => f.endsWith("schema.ts")));
      assert.ok(result.filesWritten.some((f) => f.endsWith("resolvers.ts")));
    });
  });

  describe("error handling and exit code (Task 4.4)", () => {
    it("should skip file output when there are critical errors", async () => {
      const config: GenerationConfig = {
        cwd: testDir,
        typesDir: join(testDir, "nonexistent/types"),
        resolversDir: join(testDir, "nonexistent/resolvers"),
        outputDir: join(testDir, "generated"),
      };

      const result = await executeGeneration(config);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.filesWritten.length, 0);
    });

    it("should return success=true when no errors", async () => {
      await setupTypesDir({
        "user.ts": "export interface User { id: string; }",
      });
      await setupResolversDir({
        "query.ts": `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<NoArgs, User>(function() { return { id: "1" }; });
        `,
      });

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir: join(testDir, "src/gql/types"),
        resolversDir: join(testDir, "src/gql/resolvers"),
        outputDir: join(testDir, "generated"),
      };

      const result = await executeGeneration(config);

      assert.strictEqual(result.success, true);
      assert.ok(result.filesWritten.length > 0);
    });
  });
});
