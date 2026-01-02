import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
        configDir: null,
        customScalars: null,
        output: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some((d) => d.code === "DIRECTORY_NOT_FOUND"));
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
        configDir: null,
        customScalars: null,
        output: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(false);
      expect(result.diagnostics.some((d) => d.code === "DIRECTORY_NOT_FOUND"));
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
        configDir: null,
        customScalars: null,
        output: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(result.filesWritten.length > 0);
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
        configDir: null,
        customScalars: null,
        output: null,
      };

      const result = await executeGeneration(config);

      expect(result.diagnostics.length > 0);
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
        configDir: null,
        customScalars: null,
        output: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(result.filesWritten.some((f) => f.endsWith("schema.ts")));
      expect(result.filesWritten.some((f) => f.endsWith("resolvers.ts")));
    });
  });

  describe("error handling and exit code (Task 4.4)", () => {
    it("should skip file output when there are critical errors", async () => {
      const config: GenerationConfig = {
        cwd: testDir,
        typesDir: join(testDir, "nonexistent/types"),
        resolversDir: join(testDir, "nonexistent/resolvers"),
        outputDir: join(testDir, "generated"),
        configDir: null,
        customScalars: null,
        output: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(false);
      expect(result.filesWritten.length).toBe(0);
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
        configDir: null,
        customScalars: null,
        output: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(result.filesWritten.length > 0);
    });
  });

  describe("output control", () => {
    it("should generate SDL file when sdl path is specified", async () => {
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
        configDir: null,
        customScalars: null,
        output: {
          ast: join(testDir, "generated/schema.ts"),
          sdl: join(testDir, "generated/schema.graphql"),
        },
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(result.filesWritten.some((f) => f.endsWith("schema.ts")));
      expect(result.filesWritten.some((f) => f.endsWith("schema.graphql")));
    });

    it("should not generate AST file when ast is null", async () => {
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
        configDir: null,
        customScalars: null,
        output: {
          ast: null,
          sdl: join(testDir, "generated/schema.graphql"),
        },
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(!result.filesWritten.some((f) => f.endsWith("schema.ts")));
      expect(result.filesWritten.some((f) => f.endsWith("schema.graphql")));
    });

    it("should not generate SDL file when sdl is null", async () => {
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
        configDir: null,
        customScalars: null,
        output: {
          ast: join(testDir, "generated/schema.ts"),
          sdl: null,
        },
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(result.filesWritten.some((f) => f.endsWith("schema.ts")));
      expect(!result.filesWritten.some((f) => f.endsWith(".graphql")));
    });

    it("should still generate resolvers.ts when both ast and sdl are null", async () => {
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
        configDir: null,
        customScalars: null,
        output: {
          ast: null,
          sdl: null,
        },
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(!result.filesWritten.some((f) => f.endsWith("schema.ts")));
      expect(!result.filesWritten.some((f) => f.endsWith(".graphql")));
      expect(result.filesWritten.some((f) => f.endsWith("resolvers.ts")));
    });
  });
});
