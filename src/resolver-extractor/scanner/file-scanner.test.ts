import assert from "node:assert";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { scanResolverDirectory } from "./file-scanner.js";

describe("scanResolverDirectory", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "gqlkit-resolver-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("basic scanning (Requirement 1.1)", () => {
    it("should find .ts files in the directory", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        "export type QueryResolver = {};",
      );
      await writeFile(
        join(tempDir, "user.ts"),
        "export type UserResolver = {};",
      );

      const result = await scanResolverDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 2);
      assert.ok(result.files.some((f) => f.endsWith("query.ts")));
      assert.ok(result.files.some((f) => f.endsWith("user.ts")));
    });

    it("should recursively scan subdirectories", async () => {
      await mkdir(join(tempDir, "resolvers"), { recursive: true });
      await writeFile(
        join(tempDir, "resolvers", "query.ts"),
        "export type QueryResolver = {};",
      );
      await writeFile(
        join(tempDir, "index.ts"),
        "export * from './resolvers/query.js';",
      );

      const result = await scanResolverDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 2);
      assert.ok(result.files.some((f) => f.includes("resolvers/query.ts")));
      assert.ok(result.files.some((f) => f.endsWith("index.ts")));
    });

    it("should return absolute paths", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        "export type QueryResolver = {};",
      );

      const result = await scanResolverDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 1);
      assert.ok(result.files[0]?.startsWith("/"));
    });
  });

  describe("directory not found error (Requirement 1.2)", () => {
    it("should return DIRECTORY_NOT_FOUND error for non-existent directory", async () => {
      const nonExistentPath = join(tempDir, "non-existent");

      const result = await scanResolverDirectory(nonExistentPath);

      assert.strictEqual(result.files.length, 0);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0]?.code, "DIRECTORY_NOT_FOUND");
      assert.strictEqual(result.errors[0]?.severity, "error");
      assert.ok(result.errors[0]?.message.includes("non-existent"));
    });

    it("should return DIRECTORY_NOT_FOUND error when path is a file", async () => {
      const filePath = join(tempDir, "file.txt");
      await writeFile(filePath, "content");

      const result = await scanResolverDirectory(filePath);

      assert.strictEqual(result.files.length, 0);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0]?.code, "DIRECTORY_NOT_FOUND");
      assert.ok(result.errors[0]?.message.includes("not a directory"));
    });
  });

  describe("empty directory (Requirement 1.3)", () => {
    it("should return empty array for empty directory without error", async () => {
      const result = await scanResolverDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 0);
    });

    it("should return empty array for directory with no .ts files", async () => {
      await writeFile(join(tempDir, "readme.md"), "# Readme");
      await writeFile(join(tempDir, "config.json"), "{}");

      const result = await scanResolverDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 0);
    });
  });

  describe("exclude .d.ts files (Requirement 1.4)", () => {
    it("should exclude .d.ts files", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        "export type QueryResolver = {};",
      );
      await writeFile(
        join(tempDir, "query.d.ts"),
        "declare type QueryResolver = {};",
      );

      const result = await scanResolverDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 1);
      assert.ok(result.files[0]?.endsWith("query.ts"));
      assert.ok(!result.files[0]?.endsWith(".d.ts"));
    });
  });

  describe("exclude test files (Requirement 1.5)", () => {
    it("should exclude .test.ts files", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        "export type QueryResolver = {};",
      );
      await writeFile(
        join(tempDir, "query.test.ts"),
        "describe('query', () => {});",
      );

      const result = await scanResolverDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 1);
      assert.ok(result.files[0]?.endsWith("query.ts"));
      assert.ok(!result.files.some((f) => f.endsWith(".test.ts")));
    });

    it("should exclude .spec.ts files", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        "export type QueryResolver = {};",
      );
      await writeFile(
        join(tempDir, "query.spec.ts"),
        "describe('query', () => {});",
      );

      const result = await scanResolverDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 1);
      assert.ok(result.files[0]?.endsWith("query.ts"));
      assert.ok(!result.files.some((f) => f.endsWith(".spec.ts")));
    });

    it("should exclude both .test.ts and .spec.ts files in nested directories", async () => {
      await mkdir(join(tempDir, "resolvers"), { recursive: true });
      await writeFile(
        join(tempDir, "resolvers", "query.ts"),
        "export type QueryResolver = {};",
      );
      await writeFile(
        join(tempDir, "resolvers", "query.test.ts"),
        "describe('query', () => {});",
      );
      await writeFile(
        join(tempDir, "resolvers", "mutation.ts"),
        "export type MutationResolver = {};",
      );
      await writeFile(
        join(tempDir, "resolvers", "mutation.spec.ts"),
        "describe('mutation', () => {});",
      );

      const result = await scanResolverDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 2);
      assert.ok(result.files.some((f) => f.endsWith("query.ts")));
      assert.ok(result.files.some((f) => f.endsWith("mutation.ts")));
      assert.ok(!result.files.some((f) => f.endsWith(".test.ts")));
      assert.ok(!result.files.some((f) => f.endsWith(".spec.ts")));
    });
  });

  describe("exclude node_modules", () => {
    it("should exclude node_modules directory", async () => {
      await mkdir(join(tempDir, "node_modules", "some-package"), {
        recursive: true,
      });
      await writeFile(
        join(tempDir, "node_modules", "some-package", "index.ts"),
        "export {};",
      );
      await writeFile(
        join(tempDir, "query.ts"),
        "export type QueryResolver = {};",
      );

      const result = await scanResolverDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 1);
      assert.ok(result.files[0]?.endsWith("query.ts"));
    });
  });

  describe("sorting (deterministic output)", () => {
    it("should sort files alphabetically for deterministic order", async () => {
      await writeFile(
        join(tempDir, "zebra.ts"),
        "export type ZebraResolver = {};",
      );
      await writeFile(
        join(tempDir, "apple.ts"),
        "export type AppleResolver = {};",
      );
      await writeFile(
        join(tempDir, "mango.ts"),
        "export type MangoResolver = {};",
      );

      const result = await scanResolverDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 3);
      assert.ok(result.files[0]?.endsWith("apple.ts"));
      assert.ok(result.files[1]?.endsWith("mango.ts"));
      assert.ok(result.files[2]?.endsWith("zebra.ts"));
    });
  });
});
