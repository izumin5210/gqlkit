import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

      expect(result.errors.length).toBe(0);
      expect(result.files.length).toBe(2);
      expect(result.files.some((f) => f.endsWith("query.ts"))).toBe(true);
      expect(result.files.some((f) => f.endsWith("user.ts"))).toBe(true);
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

      expect(result.errors.length).toBe(0);
      expect(result.files.length).toBe(2);
      expect(result.files.some((f) => f.includes("resolvers/query.ts"))).toBe(
        true,
      );
      expect(result.files.some((f) => f.endsWith("index.ts"))).toBe(true);
    });

    it("should return absolute paths", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        "export type QueryResolver = {};",
      );

      const result = await scanResolverDirectory(tempDir);

      expect(result.errors.length).toBe(0);
      expect(result.files.length).toBe(1);
      expect(result.files[0]?.startsWith("/")).toBe(true);
    });
  });

  describe("directory not found error (Requirement 1.2)", () => {
    it("should return DIRECTORY_NOT_FOUND error for non-existent directory", async () => {
      const nonExistentPath = join(tempDir, "non-existent");

      const result = await scanResolverDirectory(nonExistentPath);

      expect(result.files.length).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.code).toBe("DIRECTORY_NOT_FOUND");
      expect(result.errors[0]?.severity).toBe("error");
      expect(result.errors[0]?.message).toContain("non-existent");
    });

    it("should return DIRECTORY_NOT_FOUND error when path is a file", async () => {
      const filePath = join(tempDir, "file.txt");
      await writeFile(filePath, "content");

      const result = await scanResolverDirectory(filePath);

      expect(result.files.length).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.code).toBe("DIRECTORY_NOT_FOUND");
      expect(result.errors[0]?.message).toContain("not a directory");
    });
  });

  describe("empty directory (Requirement 1.3)", () => {
    it("should return empty array for empty directory without error", async () => {
      const result = await scanResolverDirectory(tempDir);

      expect(result.errors.length).toBe(0);
      expect(result.files.length).toBe(0);
    });

    it("should return empty array for directory with no .ts files", async () => {
      await writeFile(join(tempDir, "readme.md"), "# Readme");
      await writeFile(join(tempDir, "config.json"), "{}");

      const result = await scanResolverDirectory(tempDir);

      expect(result.errors.length).toBe(0);
      expect(result.files.length).toBe(0);
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

      expect(result.errors.length).toBe(0);
      expect(result.files.length).toBe(1);
      expect(result.files[0]?.endsWith("query.ts")).toBe(true);
      expect(result.files[0]?.endsWith(".d.ts")).toBe(false);
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

      expect(result.errors.length).toBe(0);
      expect(result.files.length).toBe(1);
      expect(result.files[0]?.endsWith("query.ts")).toBe(true);
      expect(result.files.some((f) => f.endsWith(".test.ts"))).toBe(false);
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

      expect(result.errors.length).toBe(0);
      expect(result.files.length).toBe(1);
      expect(result.files[0]?.endsWith("query.ts")).toBe(true);
      expect(result.files.some((f) => f.endsWith(".spec.ts"))).toBe(false);
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

      expect(result.errors.length).toBe(0);
      expect(result.files.length).toBe(2);
      expect(result.files.some((f) => f.endsWith("query.ts"))).toBe(true);
      expect(result.files.some((f) => f.endsWith("mutation.ts"))).toBe(true);
      expect(result.files.some((f) => f.endsWith(".test.ts"))).toBe(false);
      expect(result.files.some((f) => f.endsWith(".spec.ts"))).toBe(false);
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

      expect(result.errors.length).toBe(0);
      expect(result.files.length).toBe(1);
      expect(result.files[0]?.endsWith("query.ts")).toBe(true);
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

      expect(result.errors.length).toBe(0);
      expect(result.files.length).toBe(3);
      expect(result.files[0]?.endsWith("apple.ts")).toBe(true);
      expect(result.files[1]?.endsWith("mango.ts")).toBe(true);
      expect(result.files[2]?.endsWith("zebra.ts")).toBe(true);
    });
  });
});
