import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectExistingProject } from "./existing-project-detector.js";

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `gqlkit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function writeFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

describe("detectExistingProject", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("when createGqlkitApis is called", () => {
    it("detects createGqlkitApis call in gqlkitDir", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");
      mkdirSync(schemaDir, { recursive: true });
      writeFile(
        join(gqlkitDir, "gqlkit.ts"),
        `import { createGqlkitApis } from "@gqlkit-ts/runtime";
export const { defineQuery } = createGqlkitApis<{}>();`,
      );

      const result = await detectExistingProject({
        gqlkitDir,
        schemaDir,
      });

      expect(result.hasExistingSetup).toBe(true);
      expect(result.detectedFiles).toHaveLength(1);
      expect(result.detectedFiles[0]).toContain("gqlkit.ts");
    });

    it("detects createGqlkitApis call in schemaDir", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");
      mkdirSync(schemaDir, { recursive: true });
      writeFile(
        join(schemaDir, "setup.ts"),
        `import { createGqlkitApis } from "@gqlkit-ts/runtime";
const apis = createGqlkitApis<{}>();`,
      );

      const result = await detectExistingProject({
        gqlkitDir,
        schemaDir,
      });

      expect(result.hasExistingSetup).toBe(true);
      expect(result.detectedFiles).toHaveLength(1);
      expect(result.detectedFiles[0]).toContain("setup.ts");
    });

    it("detects createGqlkitApis call in .mts file", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");
      mkdirSync(schemaDir, { recursive: true });
      writeFile(
        join(gqlkitDir, "gqlkit.mts"),
        `import { createGqlkitApis } from "@gqlkit-ts/runtime";
export const { defineQuery } = createGqlkitApis<{}>();`,
      );

      const result = await detectExistingProject({
        gqlkitDir,
        schemaDir,
      });

      expect(result.hasExistingSetup).toBe(true);
      expect(result.detectedFiles).toHaveLength(1);
    });

    it("detects createGqlkitApis call in .cts file", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");
      mkdirSync(schemaDir, { recursive: true });
      writeFile(
        join(gqlkitDir, "gqlkit.cts"),
        `const { createGqlkitApis } = require("@gqlkit-ts/runtime");
const apis = createGqlkitApis();`,
      );

      const result = await detectExistingProject({
        gqlkitDir,
        schemaDir,
      });

      expect(result.hasExistingSetup).toBe(true);
    });
  });

  describe("when no createGqlkitApis is found", () => {
    it("returns hasExistingSetup as false when directories are empty", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");
      mkdirSync(schemaDir, { recursive: true });

      const result = await detectExistingProject({
        gqlkitDir,
        schemaDir,
      });

      expect(result.hasExistingSetup).toBe(false);
      expect(result.detectedFiles).toHaveLength(0);
    });

    it("returns hasExistingSetup as false when directories do not exist", async () => {
      const gqlkitDir = join(tempDir, "nonexistent", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");

      const result = await detectExistingProject({
        gqlkitDir,
        schemaDir,
      });

      expect(result.hasExistingSetup).toBe(false);
      expect(result.detectedFiles).toHaveLength(0);
    });

    it("returns hasExistingSetup as false when files do not contain createGqlkitApis", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");
      mkdirSync(schemaDir, { recursive: true });
      writeFile(
        join(gqlkitDir, "context.ts"),
        `export type GqlkitContext = {};`,
      );
      writeFile(
        join(schemaDir, "User.ts"),
        `export type User = { id: string; name: string; };`,
      );

      const result = await detectExistingProject({
        gqlkitDir,
        schemaDir,
      });

      expect(result.hasExistingSetup).toBe(false);
      expect(result.detectedFiles).toHaveLength(0);
    });

    it("ignores non-TypeScript files", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");
      mkdirSync(schemaDir, { recursive: true });
      writeFile(
        join(gqlkitDir, "notes.txt"),
        `createGqlkitApis is called somewhere`,
      );
      writeFile(join(gqlkitDir, "config.json"), `{"createGqlkitApis": true}`);

      const result = await detectExistingProject({
        gqlkitDir,
        schemaDir,
      });

      expect(result.hasExistingSetup).toBe(false);
    });
  });

  describe("multiple files", () => {
    it("detects all files containing createGqlkitApis", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");
      mkdirSync(schemaDir, { recursive: true });
      writeFile(
        join(gqlkitDir, "gqlkit.ts"),
        `import { createGqlkitApis } from "@gqlkit-ts/runtime";`,
      );
      writeFile(
        join(schemaDir, "setup.ts"),
        `import { createGqlkitApis } from "@gqlkit-ts/runtime";`,
      );

      const result = await detectExistingProject({
        gqlkitDir,
        schemaDir,
      });

      expect(result.hasExistingSetup).toBe(true);
      expect(result.detectedFiles).toHaveLength(2);
    });
  });
});
