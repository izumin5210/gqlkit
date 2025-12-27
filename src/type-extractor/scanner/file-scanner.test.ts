import assert from "node:assert";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { scanDirectory } from "./file-scanner.js";

describe("scanDirectory", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "gqlkit-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("basic scanning", () => {
    it("should find .ts files in the directory", async () => {
      await writeFile(join(tempDir, "user.ts"), "export type User = {};");
      await writeFile(join(tempDir, "post.ts"), "export type Post = {};");

      const result = await scanDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 2);
      assert.ok(result.files.some((f) => f.endsWith("user.ts")));
      assert.ok(result.files.some((f) => f.endsWith("post.ts")));
    });

    it("should recursively scan subdirectories", async () => {
      await mkdir(join(tempDir, "types"), { recursive: true });
      await writeFile(
        join(tempDir, "types", "user.ts"),
        "export type User = {};",
      );
      await writeFile(
        join(tempDir, "index.ts"),
        "export * from './types/user';",
      );

      const result = await scanDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 2);
      assert.ok(result.files.some((f) => f.includes("types/user.ts")));
      assert.ok(result.files.some((f) => f.endsWith("index.ts")));
    });

    it("should return absolute paths", async () => {
      await writeFile(join(tempDir, "user.ts"), "export type User = {};");

      const result = await scanDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 1);
      assert.ok(result.files[0]?.startsWith("/"));
    });
  });

  describe("file filtering", () => {
    it("should exclude .d.ts files", async () => {
      await writeFile(join(tempDir, "user.ts"), "export type User = {};");
      await writeFile(join(tempDir, "user.d.ts"), "declare type User = {};");

      const result = await scanDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 1);
      assert.ok(result.files[0]?.endsWith("user.ts"));
    });

    it("should exclude node_modules directory", async () => {
      await mkdir(join(tempDir, "node_modules", "some-package"), {
        recursive: true,
      });
      await writeFile(
        join(tempDir, "node_modules", "some-package", "index.ts"),
        "export {};",
      );
      await writeFile(join(tempDir, "user.ts"), "export type User = {};");

      const result = await scanDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 1);
      assert.ok(result.files[0]?.endsWith("user.ts"));
    });

    it("should ignore non-TypeScript files", async () => {
      await writeFile(join(tempDir, "user.ts"), "export type User = {};");
      await writeFile(join(tempDir, "readme.md"), "# Readme");
      await writeFile(join(tempDir, "config.json"), "{}");

      const result = await scanDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 1);
      assert.ok(result.files[0]?.endsWith("user.ts"));
    });
  });

  describe("empty directory", () => {
    it("should return empty array for directory with no .ts files", async () => {
      await writeFile(join(tempDir, "readme.md"), "# Readme");

      const result = await scanDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 0);
    });

    it("should return empty array for empty directory", async () => {
      const result = await scanDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 0);
    });
  });

  describe("sorting", () => {
    it("should sort files alphabetically for deterministic order", async () => {
      await writeFile(join(tempDir, "zebra.ts"), "export type Zebra = {};");
      await writeFile(join(tempDir, "apple.ts"), "export type Apple = {};");
      await writeFile(join(tempDir, "mango.ts"), "export type Mango = {};");

      const result = await scanDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 3);
      assert.ok(result.files[0]?.endsWith("apple.ts"));
      assert.ok(result.files[1]?.endsWith("mango.ts"));
      assert.ok(result.files[2]?.endsWith("zebra.ts"));
    });

    it("should sort files including subdirectories alphabetically", async () => {
      await mkdir(join(tempDir, "aaa"), { recursive: true });
      await mkdir(join(tempDir, "bbb"), { recursive: true });
      await writeFile(
        join(tempDir, "bbb", "first.ts"),
        "export type First = {};",
      );
      await writeFile(
        join(tempDir, "aaa", "second.ts"),
        "export type Second = {};",
      );
      await writeFile(join(tempDir, "root.ts"), "export type Root = {};");

      const result = await scanDirectory(tempDir);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.files.length, 3);
      assert.ok(result.files[0]?.includes("aaa/second.ts"));
      assert.ok(result.files[1]?.includes("bbb/first.ts"));
      assert.ok(result.files[2]?.endsWith("root.ts"));
    });
  });

  describe("error handling", () => {
    it("should return DIRECTORY_NOT_FOUND error for non-existent directory", async () => {
      const nonExistentPath = join(tempDir, "non-existent");

      const result = await scanDirectory(nonExistentPath);

      assert.strictEqual(result.files.length, 0);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0]?.code, "DIRECTORY_NOT_FOUND");
      assert.strictEqual(result.errors[0]?.severity, "error");
      assert.ok(result.errors[0]?.message.includes("non-existent"));
    });

    it("should return DIRECTORY_NOT_FOUND error when path is a file", async () => {
      const filePath = join(tempDir, "file.txt");
      await writeFile(filePath, "content");

      const result = await scanDirectory(filePath);

      assert.strictEqual(result.files.length, 0);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0]?.code, "DIRECTORY_NOT_FOUND");
      assert.ok(result.errors[0]?.message.includes("not a directory"));
    });

    it("should include absolute path in error message", async () => {
      const nonExistentPath = join(tempDir, "missing");

      const result = await scanDirectory(nonExistentPath);

      assert.strictEqual(result.errors.length, 1);
      assert.ok(result.errors[0]?.message.includes(tempDir));
    });
  });
});
