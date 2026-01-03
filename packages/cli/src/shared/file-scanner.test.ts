import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isTypeScriptSourceFile, scanDirectory } from "./file-scanner.js";

describe("FileScanner", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-scanner-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  describe("isTypeScriptSourceFile", () => {
    it("should return true for .ts files", () => {
      expect(isTypeScriptSourceFile("foo.ts")).toBe(true);
    });

    it("should return true for .cts files", () => {
      expect(isTypeScriptSourceFile("foo.cts")).toBe(true);
    });

    it("should return true for .mts files", () => {
      expect(isTypeScriptSourceFile("foo.mts")).toBe(true);
    });

    it("should return false for .d.ts files", () => {
      expect(isTypeScriptSourceFile("foo.d.ts")).toBe(false);
    });

    it("should return false for .d.cts files", () => {
      expect(isTypeScriptSourceFile("foo.d.cts")).toBe(false);
    });

    it("should return false for .d.mts files", () => {
      expect(isTypeScriptSourceFile("foo.d.mts")).toBe(false);
    });

    it("should return false for .js files", () => {
      expect(isTypeScriptSourceFile("foo.js")).toBe(false);
    });

    it("should return false for .tsx files", () => {
      expect(isTypeScriptSourceFile("foo.tsx")).toBe(false);
    });
  });

  describe("scanDirectory", () => {
    it("should scan .ts, .cts, .mts files recursively", async () => {
      fs.mkdirSync(path.join(tempDir, "subdir"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "foo.ts"), "");
      fs.writeFileSync(path.join(tempDir, "bar.cts"), "");
      fs.writeFileSync(path.join(tempDir, "baz.mts"), "");
      fs.writeFileSync(path.join(tempDir, "subdir", "nested.ts"), "");

      const result = await scanDirectory(tempDir);

      expect(result.errors).toEqual([]);
      expect(result.files).toHaveLength(4);
      expect(result.files).toContain(path.join(tempDir, "foo.ts"));
      expect(result.files).toContain(path.join(tempDir, "bar.cts"));
      expect(result.files).toContain(path.join(tempDir, "baz.mts"));
      expect(result.files).toContain(path.join(tempDir, "subdir", "nested.ts"));
    });

    it("should exclude .d.ts, .d.cts, .d.mts files", async () => {
      fs.writeFileSync(path.join(tempDir, "types.d.ts"), "");
      fs.writeFileSync(path.join(tempDir, "types.d.cts"), "");
      fs.writeFileSync(path.join(tempDir, "types.d.mts"), "");
      fs.writeFileSync(path.join(tempDir, "source.ts"), "");

      const result = await scanDirectory(tempDir);

      expect(result.errors).toEqual([]);
      expect(result.files).toHaveLength(1);
      expect(result.files).toContain(path.join(tempDir, "source.ts"));
    });

    it("should return error for non-existent directory", async () => {
      const result = await scanDirectory(path.join(tempDir, "non-existent"));

      expect(result.files).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe("DIRECTORY_NOT_FOUND");
    });

    describe("excludeGlobs option", () => {
      it("should exclude files matching glob patterns", async () => {
        fs.mkdirSync(path.join(tempDir, "__tests__"), { recursive: true });
        fs.writeFileSync(path.join(tempDir, "source.ts"), "");
        fs.writeFileSync(path.join(tempDir, "source.test.ts"), "");
        fs.writeFileSync(path.join(tempDir, "source.spec.ts"), "");
        fs.writeFileSync(path.join(tempDir, "__tests__", "test.ts"), "");

        const result = await scanDirectory(tempDir, {
          excludeGlobs: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"],
        });

        expect(result.errors).toEqual([]);
        expect(result.files).toHaveLength(1);
        expect(result.files).toContain(path.join(tempDir, "source.ts"));
      });

      it("should handle empty excludeGlobs array", async () => {
        fs.writeFileSync(path.join(tempDir, "source.ts"), "");

        const result = await scanDirectory(tempDir, {
          excludeGlobs: [],
        });

        expect(result.errors).toEqual([]);
        expect(result.files).toHaveLength(1);
      });
    });

    describe("excludePaths option", () => {
      it("should exclude specific file paths", async () => {
        const generatedPath = path.join(tempDir, "generated", "resolvers.ts");
        fs.mkdirSync(path.join(tempDir, "generated"), { recursive: true });
        fs.writeFileSync(path.join(tempDir, "source.ts"), "");
        fs.writeFileSync(generatedPath, "");

        const result = await scanDirectory(tempDir, {
          excludePaths: [generatedPath],
        });

        expect(result.errors).toEqual([]);
        expect(result.files).toHaveLength(1);
        expect(result.files).toContain(path.join(tempDir, "source.ts"));
      });

      it("should exclude multiple paths", async () => {
        const resolversPath = path.join(tempDir, "generated", "resolvers.ts");
        const typeDefsPath = path.join(tempDir, "generated", "typeDefs.ts");
        fs.mkdirSync(path.join(tempDir, "generated"), { recursive: true });
        fs.writeFileSync(path.join(tempDir, "source.ts"), "");
        fs.writeFileSync(resolversPath, "");
        fs.writeFileSync(typeDefsPath, "");

        const result = await scanDirectory(tempDir, {
          excludePaths: [resolversPath, typeDefsPath],
        });

        expect(result.errors).toEqual([]);
        expect(result.files).toHaveLength(1);
        expect(result.files).toContain(path.join(tempDir, "source.ts"));
      });
    });

    it("should combine excludeGlobs and excludePaths", async () => {
      const generatedPath = path.join(tempDir, "generated", "resolvers.ts");
      fs.mkdirSync(path.join(tempDir, "generated"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, "source.ts"), "");
      fs.writeFileSync(path.join(tempDir, "source.test.ts"), "");
      fs.writeFileSync(generatedPath, "");

      const result = await scanDirectory(tempDir, {
        excludeGlobs: ["**/*.test.ts"],
        excludePaths: [generatedPath],
      });

      expect(result.errors).toEqual([]);
      expect(result.files).toHaveLength(1);
      expect(result.files).toContain(path.join(tempDir, "source.ts"));
    });
  });
});
