import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

      expect(result.success).toBe(true);
      expect(result.writtenPaths.length).toBe(1);

      const content = await readFile(join(testDir, "schema.ts"), "utf-8");
      expect(content).toBe("export const typeDefs = {};");
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

      expect(result.success).toBe(true);
      const stats = await stat(nestedDir);
      expect(stats.isDirectory()).toBe(true);
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

      expect(result.success).toBe(true);
      expect(result.writtenPaths.length).toBe(2);

      const schemaContent = await readFile(join(testDir, "schema.ts"), "utf-8");
      expect(schemaContent).toBe("export const typeDefs = {};");

      const resolversContent = await readFile(
        join(testDir, "resolvers.ts"),
        "utf-8",
      );
      expect(resolversContent).toBe("export const resolvers = {};");
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

      expect(result.success).toBe(true);
      const content = await readFile(filePath, "utf-8");
      expect(content).toBe(newContent);
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

      expect(result.success).toBe(true);
      expect(result.writtenPaths.includes(join(testDir, "schema.ts"))).toBe(
        true,
      );
      expect(result.writtenPaths.includes(join(testDir, "resolvers.ts"))).toBe(
        true,
      );
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

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
