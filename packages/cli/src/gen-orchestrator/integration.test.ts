import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeGeneration, type GenerationConfig } from "./orchestrator.js";

describe("Integration Tests", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "gqlkit-integration-test-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true });
  });

  describe("successful pipeline (Task 6.1)", () => {
    it("should generate complete schema from types and resolvers", async () => {
      const typesDir = join(testDir, "src/gql/types");
      const resolversDir = join(testDir, "src/gql/resolvers");
      const outputDir = join(testDir, "src/gqlkit/generated");

      await mkdir(typesDir, { recursive: true });
      await mkdir(resolversDir, { recursive: true });

      await writeFile(
        join(typesDir, "user.ts"),
        `export interface User {
          id: string;
          name: string;
          email: string | null;
        }`,
        "utf-8",
      );

      await writeFile(
        join(typesDir, "post.ts"),
        `export interface Post {
          id: string;
          title: string;
          content: string;
        }`,
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; name: string; email: string | null; }
          interface Post { id: string; title: string; content: string; }
          const { defineQuery } = createGqlkitApis<Context>();

          export const user = defineQuery<{ id: string }, User | null>(
            function(_root, args) { return { id: args.id, name: "test", email: null }; }
          );
          export const users = defineQuery<NoArgs, User[]>(
            function() { return []; }
          );
          export const post = defineQuery<{ id: string }, Post | null>(
            function(_root, args) { return { id: args.id, title: "test", content: "test" }; }
          );
        `,
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "user.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; name: string; email: string | null; }
          interface Post { id: string; title: string; content: string; }
          const { defineField } = createGqlkitApis<Context>();

          export const posts = defineField<User, NoArgs, Post[]>(
            function() { return []; }
          );
        `,
        "utf-8",
      );

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir,
        resolversDir,
        outputDir,
      };

      const result = await executeGeneration(config);

      expect(result.success, true);
      expect(result.filesWritten.length, 3);

      const schemaContent = await readFile(
        join(outputDir, "schema.ts"),
        "utf-8",
      );
      expect(schemaContent.includes("typeDefs"));
      expect(schemaContent.includes("User"));
      expect(schemaContent.includes("Post"));
      expect(schemaContent.includes("Query"));

      const resolversContent = await readFile(
        join(outputDir, "resolvers.ts"),
        "utf-8",
      );
      expect(resolversContent.includes("resolvers"));
      expect(resolversContent.includes("Query"));
      expect(resolversContent.includes("User"));
    });

    it("should generate valid TypeScript code", async () => {
      const typesDir = join(testDir, "src/gql/types");
      const resolversDir = join(testDir, "src/gql/resolvers");
      const outputDir = join(testDir, "src/gqlkit/generated");

      await mkdir(typesDir, { recursive: true });
      await mkdir(resolversDir, { recursive: true });

      await writeFile(
        join(typesDir, "user.ts"),
        "export interface User { id: string; }",
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<NoArgs, User>(function() { return { id: "1" }; });
        `,
        "utf-8",
      );

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir,
        resolversDir,
        outputDir,
      };

      const result = await executeGeneration(config);

      expect(result.success, true);

      const schemaContent = await readFile(
        join(outputDir, "schema.ts"),
        "utf-8",
      );
      expect(schemaContent.includes("import type { DocumentNode }"));
      expect(schemaContent.includes("export const typeDefs"));
    });

    it("should handle mutations", async () => {
      const typesDir = join(testDir, "src/gql/types");
      const resolversDir = join(testDir, "src/gql/resolvers");
      const outputDir = join(testDir, "src/gqlkit/generated");

      await mkdir(typesDir, { recursive: true });
      await mkdir(resolversDir, { recursive: true });

      await writeFile(
        join(typesDir, "user.ts"),
        "export interface User { id: string; name: string; }",
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "mutation.ts"),
        `
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; name: string; }
          const { defineMutation } = createGqlkitApis<Context>();
          export const createUser = defineMutation<{ name: string }, User>(
            function(_root, args) { return { id: "1", name: args.name }; }
          );
        `,
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; name: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const users = defineQuery<NoArgs, User[]>(function() { return []; });
        `,
        "utf-8",
      );

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir,
        resolversDir,
        outputDir,
      };

      const result = await executeGeneration(config);

      expect(result.success, true);

      const schemaContent = await readFile(
        join(outputDir, "schema.ts"),
        "utf-8",
      );
      expect(schemaContent.includes("Mutation"));
      expect(schemaContent.includes("createUser"));
    });
  });

  describe("custom scalar configuration (Task 8.1)", () => {
    it("should generate schema with custom scalar definitions", async () => {
      const typesDir = join(testDir, "src/gql/types");
      const resolversDir = join(testDir, "src/gql/resolvers");
      const outputDir = join(testDir, "src/gqlkit/generated");

      await mkdir(typesDir, { recursive: true });
      await mkdir(resolversDir, { recursive: true });

      await writeFile(
        join(typesDir, "event.ts"),
        `export interface Event {
          id: string;
          createdAt: DateTime;
        }
        type DateTime = string & { readonly __brand: unique symbol };`,
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface Event { id: string; createdAt: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const events = defineQuery<NoArgs, Event[]>(function() { return []; });
        `,
        "utf-8",
      );

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir,
        resolversDir,
        outputDir,
        customScalars: [
          {
            graphqlName: "DateTime",
            typeName: "DateTime",
            importPath: "./src/scalars",
          },
        ],
      };

      const result = await executeGeneration(config);

      expect(result.success, true);

      const schemaContent = await readFile(
        join(outputDir, "schema.ts"),
        "utf-8",
      );
      expect(
        schemaContent.includes('"kind": "ScalarTypeDefinition"'),
        "Schema should include scalar type definition",
      );
      expect(
        schemaContent.includes('"value": "DateTime"'),
        "Schema should include DateTime scalar",
      );
    });

    it("should generate schema with multiple custom scalars", async () => {
      const typesDir = join(testDir, "src/gql/types");
      const resolversDir = join(testDir, "src/gql/resolvers");
      const outputDir = join(testDir, "src/gqlkit/generated");

      await mkdir(typesDir, { recursive: true });
      await mkdir(resolversDir, { recursive: true });

      await writeFile(
        join(typesDir, "event.ts"),
        `export interface Event {
          id: string;
          createdAt: DateTime;
          metadata: JSON;
        }
        type DateTime = string & { readonly __brand: unique symbol };
        type JSON = object & { readonly __brand: unique symbol };`,
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface Event { id: string; createdAt: string; metadata: object; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const events = defineQuery<NoArgs, Event[]>(function() { return []; });
        `,
        "utf-8",
      );

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir,
        resolversDir,
        outputDir,
        customScalars: [
          {
            graphqlName: "DateTime",
            typeName: "DateTime",
            importPath: "./src/scalars",
          },
          {
            graphqlName: "JSON",
            typeName: "JSON",
            importPath: "./src/scalars",
          },
        ],
      };

      const result = await executeGeneration(config);

      expect(result.success, true);

      const schemaContent = await readFile(
        join(outputDir, "schema.ts"),
        "utf-8",
      );
      expect(schemaContent.includes('"value": "DateTime"'));
      expect(schemaContent.includes('"value": "JSON"'));
    });

    it("should pass validation when custom scalar is referenced in type", async () => {
      const typesDir = join(testDir, "src/gql/types");
      const resolversDir = join(testDir, "src/gql/resolvers");
      const outputDir = join(testDir, "src/gqlkit/generated");

      await mkdir(typesDir, { recursive: true });
      await mkdir(resolversDir, { recursive: true });

      await writeFile(
        join(typesDir, "user.ts"),
        `export interface User {
          id: string;
          createdAt: DateTime;
        }
        type DateTime = string;`,
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; createdAt: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<NoArgs, User>(function() { return { id: "1", createdAt: "2024-01-01" }; });
        `,
        "utf-8",
      );

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir,
        resolversDir,
        outputDir,
        customScalars: [
          {
            graphqlName: "DateTime",
            typeName: "DateTime",
            importPath: "./src/scalars",
          },
        ],
      };

      const result = await executeGeneration(config);

      expect(result.success, true);
      expect(
        result.diagnostics.filter((d) => d.code === "UNRESOLVED_REFERENCE")
          .length,
        0,
        "Should not have unresolved reference errors for custom scalars",
      );
    });

    it("should fail validation for unknown type reference when not in custom scalars", async () => {
      const typesDir = join(testDir, "src/gql/types");
      const resolversDir = join(testDir, "src/gql/resolvers");
      const outputDir = join(testDir, "src/gqlkit/generated");

      await mkdir(typesDir, { recursive: true });
      await mkdir(resolversDir, { recursive: true });

      await writeFile(
        join(typesDir, "user.ts"),
        `export interface User {
          id: string;
          relation: NonExistentType;
        }`,
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<NoArgs, User>(function() { return { id: "1" }; });
        `,
        "utf-8",
      );

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir,
        resolversDir,
        outputDir,
      };

      const result = await executeGeneration(config);

      expect(result.success, false);
      expect(
        result.diagnostics.some((d) => d.code === "UNRESOLVED_REFERENCE"),
        "Should have unresolved reference error for unknown type",
      );
    });
  });

  describe("error handling (Task 6.2)", () => {
    it("should fail when types directory does not exist", async () => {
      const resolversDir = join(testDir, "src/gql/resolvers");
      await mkdir(resolversDir, { recursive: true });

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
          type Context = unknown;
          interface User { id: string; }
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<NoArgs, User>(function() { return { id: "1" }; });
        `,
        "utf-8",
      );

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir: join(testDir, "src/gql/types"),
        resolversDir,
        outputDir: join(testDir, "src/gqlkit/generated"),
      };

      const result = await executeGeneration(config);

      expect(result.success, false);
      expect(
        result.diagnostics.some((d) => d.code === "DIRECTORY_NOT_FOUND"),
      );
    });

    it("should fail when resolvers directory does not exist", async () => {
      const typesDir = join(testDir, "src/gql/types");
      await mkdir(typesDir, { recursive: true });

      await writeFile(
        join(typesDir, "user.ts"),
        "export interface User { id: string; }",
        "utf-8",
      );

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir,
        resolversDir: join(testDir, "src/gql/resolvers"),
        outputDir: join(testDir, "src/gqlkit/generated"),
      };

      const result = await executeGeneration(config);

      expect(result.success, false);
      expect(
        result.diagnostics.some((d) => d.code === "DIRECTORY_NOT_FOUND"),
      );
    });
  });
});
