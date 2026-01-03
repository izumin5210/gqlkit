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

  function hasFile(
    files: ReadonlyArray<{ filename: string; content: string }>,
    name: string,
  ): boolean {
    return files.some((f) => f.filename === name);
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
        tsconfigPath: null,
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
        tsconfigPath: null,
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
        tsconfigPath: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
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
        tsconfigPath: null,
      };

      const result = await executeGeneration(config);

      expect(result.diagnostics.length).toBeGreaterThan(0);
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
        tsconfigPath: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(hasFile(result.files, "schema.ts")).toBe(true);
      expect(hasFile(result.files, "resolvers.ts")).toBe(true);
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
        tsconfigPath: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(false);
      expect(result.files.length).toBe(0);
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
        tsconfigPath: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
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
        tsconfigPath: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(hasFile(result.files, "schema.ts")).toBe(true);
      expect(hasFile(result.files, "schema.graphql")).toBe(true);
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
        tsconfigPath: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(hasFile(result.files, "schema.ts")).toBe(false);
      expect(hasFile(result.files, "schema.graphql")).toBe(true);
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
        tsconfigPath: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(hasFile(result.files, "schema.ts")).toBe(true);
      expect(hasFile(result.files, "schema.graphql")).toBe(false);
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
        tsconfigPath: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
      expect(hasFile(result.files, "schema.ts")).toBe(false);
      expect(hasFile(result.files, "schema.graphql")).toBe(false);
      expect(hasFile(result.files, "resolvers.ts")).toBe(true);
    });
  });

  describe("tsconfig integration", () => {
    it("should use tsconfig.json when tsconfigPath is null and tsconfig.json exists", async () => {
      await writeFile(
        join(testDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            strict: true,
          },
        }),
      );

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
        tsconfigPath: null,
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
    });

    it("should use custom tsconfig when tsconfigPath is specified", async () => {
      await writeFile(
        join(testDir, "tsconfig.custom.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            strict: true,
          },
        }),
      );

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
        tsconfigPath: join(testDir, "tsconfig.custom.json"),
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(true);
    });

    it("should return error when specified tsconfig does not exist", async () => {
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
        tsconfigPath: join(testDir, "nonexistent-tsconfig.json"),
      };

      const result = await executeGeneration(config);

      expect(result.success).toBe(false);
      expect(
        result.diagnostics.some((d) => d.code === "TSCONFIG_NOT_FOUND"),
      ).toBe(true);
    });
  });
});
