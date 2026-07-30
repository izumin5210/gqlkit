import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateFiles } from "./file-generator.js";

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

describe("generateFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("file generation", () => {
    it("generates context.ts with empty GqlkitContext type", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");

      const result = await generateFiles({
        gqlkitDir,
        schemaDir,
        skipGqlkitSetup: false,
      });

      const contextPath = join(gqlkitDir, "context.ts");
      expect(existsSync(contextPath)).toBe(true);

      const content = readFileSync(contextPath, "utf-8");
      expect(content).toContain("export type GqlkitContext = {}");

      const contextFile = result.files.find((f) =>
        f.path.endsWith("context.ts"),
      );
      expect(contextFile).toBeDefined();
      expect(contextFile?.skipped).toBe(false);
    });

    it("generates gqlkit.ts with createGqlkitApis call", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");

      await generateFiles({
        gqlkitDir,
        schemaDir,
        skipGqlkitSetup: false,
      });

      const gqlkitPath = join(gqlkitDir, "gqlkit.ts");
      expect(existsSync(gqlkitPath)).toBe(true);

      const content = readFileSync(gqlkitPath, "utf-8");
      expect(content).toContain(
        'import { createGqlkitApis } from "@gqlkit-ts/runtime"',
      );
      expect(content).toContain(
        'import type { GqlkitContext } from "./context.js"',
      );
      expect(content).toContain("createGqlkitApis<GqlkitContext>()");
      expect(content).toContain("defineQuery");
      expect(content).toContain("defineMutation");
      expect(content).toContain("defineField");
    });

    it("generates schema.ts with makeExecutableSchema", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");

      await generateFiles({
        gqlkitDir,
        schemaDir,
        skipGqlkitSetup: false,
      });

      const schemaPath = join(gqlkitDir, "schema.ts");
      expect(existsSync(schemaPath)).toBe(true);

      const content = readFileSync(schemaPath, "utf-8");
      expect(content).toContain(
        'import { makeExecutableSchema } from "@graphql-tools/schema"',
      );
      expect(content).toContain(
        'import { createResolvers } from "./__generated__/resolvers.js"',
      );
      expect(content).toContain(
        'import { typeDefs } from "./__generated__/typeDefs.js"',
      );
      expect(content).toContain("makeExecutableSchema({");
      expect(content).toContain("typeDefs,");
      expect(content).toContain("resolvers: createResolvers(),");
    });

    it("generates schema/.gitkeep as empty file", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");

      await generateFiles({
        gqlkitDir,
        schemaDir,
        skipGqlkitSetup: false,
      });

      const gitkeepPath = join(schemaDir, ".gitkeep");
      expect(existsSync(gitkeepPath)).toBe(true);

      const content = readFileSync(gitkeepPath, "utf-8");
      expect(content).toBe("");
    });

    it("creates necessary directories", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");

      expect(existsSync(gqlkitDir)).toBe(false);
      expect(existsSync(schemaDir)).toBe(false);

      await generateFiles({
        gqlkitDir,
        schemaDir,
        skipGqlkitSetup: false,
      });

      expect(existsSync(gqlkitDir)).toBe(true);
      expect(existsSync(schemaDir)).toBe(true);
    });
  });

  describe("skip behavior", () => {
    it("skips context.ts and gqlkit.ts when skipGqlkitSetup is true", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");

      const result = await generateFiles({
        gqlkitDir,
        schemaDir,
        skipGqlkitSetup: true,
      });

      const contextFile = result.files.find((f) =>
        f.path.endsWith("context.ts"),
      );
      const gqlkitFile = result.files.find((f) => f.path.endsWith("gqlkit.ts"));

      expect(contextFile?.skipped).toBe(true);
      expect(contextFile?.reason).toContain("existing gqlkit setup");
      expect(gqlkitFile?.skipped).toBe(true);
      expect(gqlkitFile?.reason).toContain("existing gqlkit setup");

      expect(existsSync(join(gqlkitDir, "context.ts"))).toBe(false);
      expect(existsSync(join(gqlkitDir, "gqlkit.ts"))).toBe(false);
    });

    it("still generates schema.ts and .gitkeep when skipGqlkitSetup is true", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");

      await generateFiles({
        gqlkitDir,
        schemaDir,
        skipGqlkitSetup: true,
      });

      expect(existsSync(join(gqlkitDir, "schema.ts"))).toBe(true);
      expect(existsSync(join(schemaDir, ".gitkeep"))).toBe(true);
    });

    it("skips file if it already exists", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");
      mkdirSync(gqlkitDir, { recursive: true });

      const existingContent = "existing content";
      writeFile(join(gqlkitDir, "context.ts"), existingContent);

      const result = await generateFiles({
        gqlkitDir,
        schemaDir,
        skipGqlkitSetup: false,
      });

      const contextFile = result.files.find((f) =>
        f.path.endsWith("context.ts"),
      );
      expect(contextFile?.skipped).toBe(true);
      expect(contextFile?.reason).toContain("already exists");

      const content = readFileSync(join(gqlkitDir, "context.ts"), "utf-8");
      expect(content).toBe(existingContent);
    });
  });

  describe("result structure", () => {
    it("returns all generated file information", async () => {
      const gqlkitDir = join(tempDir, "src", "gqlkit");
      const schemaDir = join(gqlkitDir, "schema");

      const result = await generateFiles({
        gqlkitDir,
        schemaDir,
        skipGqlkitSetup: false,
      });

      expect(result.files).toHaveLength(4);

      const paths = result.files.map((f) => f.path);
      expect(paths).toContain(join(gqlkitDir, "context.ts"));
      expect(paths).toContain(join(gqlkitDir, "gqlkit.ts"));
      expect(paths).toContain(join(gqlkitDir, "schema.ts"));
      expect(paths).toContain(join(schemaDir, ".gitkeep"));
    });
  });
});
