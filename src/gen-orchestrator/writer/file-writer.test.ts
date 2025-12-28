import assert from "node:assert";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { type WriteFileOptions, writeFiles } from "./file-writer.js";

describe("FileWriter", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "gqlkit-test-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true });
  });

  describe("writeFiles", () => {
    it("should write files to the output directory", async () => {
      const options: WriteFileOptions = {
        outputDir: testDir,
        files: [
          { filename: "schema.ts", content: "export const typeDefs = {};" },
        ],
      };

      const result = await writeFiles(options);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.writtenPaths.length, 1);

      const content = await readFile(join(testDir, "schema.ts"), "utf-8");
      assert.strictEqual(content, "export const typeDefs = {};");
    });

    it("should create output directory if it does not exist", async () => {
      const nestedDir = join(testDir, "generated", "nested");
      const options: WriteFileOptions = {
        outputDir: nestedDir,
        files: [
          { filename: "schema.ts", content: "export const typeDefs = {};" },
        ],
      };

      const result = await writeFiles(options);

      assert.strictEqual(result.success, true);
      const stats = await stat(nestedDir);
      assert.ok(stats.isDirectory());
    });

    it("should write multiple files", async () => {
      const options: WriteFileOptions = {
        outputDir: testDir,
        files: [
          { filename: "schema.ts", content: "export const typeDefs = {};" },
          { filename: "resolvers.ts", content: "export const resolvers = {};" },
        ],
      };

      const result = await writeFiles(options);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.writtenPaths.length, 2);

      const schemaContent = await readFile(join(testDir, "schema.ts"), "utf-8");
      assert.strictEqual(schemaContent, "export const typeDefs = {};");

      const resolversContent = await readFile(
        join(testDir, "resolvers.ts"),
        "utf-8",
      );
      assert.strictEqual(resolversContent, "export const resolvers = {};");
    });

    it("should overwrite existing files", async () => {
      const filePath = join(testDir, "schema.ts");
      await mkdir(testDir, { recursive: true });
      const originalContent = 'const old = "old";';
      await writeFiles({
        outputDir: testDir,
        files: [{ filename: "schema.ts", content: originalContent }],
      });

      const newContent = 'const new = "new";';
      const result = await writeFiles({
        outputDir: testDir,
        files: [{ filename: "schema.ts", content: newContent }],
      });

      assert.strictEqual(result.success, true);
      const content = await readFile(filePath, "utf-8");
      assert.strictEqual(content, newContent);
    });

    it("should return written file paths", async () => {
      const options: WriteFileOptions = {
        outputDir: testDir,
        files: [
          { filename: "schema.ts", content: "export const typeDefs = {};" },
          { filename: "resolvers.ts", content: "export const resolvers = {};" },
        ],
      };

      const result = await writeFiles(options);

      assert.strictEqual(result.success, true);
      assert.ok(result.writtenPaths.includes(join(testDir, "schema.ts")));
      assert.ok(result.writtenPaths.includes(join(testDir, "resolvers.ts")));
    });

    it("should return error when write fails", async () => {
      const invalidDir = join(testDir, "\0invalid");
      const options: WriteFileOptions = {
        outputDir: invalidDir,
        files: [
          { filename: "schema.ts", content: "export const typeDefs = {};" },
        ],
      };

      const result = await writeFiles(options);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });
});
