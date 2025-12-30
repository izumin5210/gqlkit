import assert from "node:assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
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
          interface User { id: string; name: string; email: string | null; }
          interface Post { id: string; title: string; content: string; }

          export type QueryResolver = {
            user: (args: { id: string }) => User | null;
            users: () => User[];
            post: (args: { id: string }) => Post | null;
          };

          export const queryResolver: QueryResolver = {
            user: (args) => ({ id: args.id, name: "test", email: null }),
            users: () => [],
            post: (args) => ({ id: args.id, title: "test", content: "test" }),
          };
        `,
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "user.ts"),
        `
          interface User { id: string; name: string; email: string | null; }
          interface Post { id: string; title: string; content: string; }

          export type UserResolver = {
            posts: (parent: User) => Post[];
          };

          export const userResolver: UserResolver = {
            posts: (parent) => [],
          };
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

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.filesWritten.length, 2);

      const schemaContent = await readFile(
        join(outputDir, "schema.ts"),
        "utf-8",
      );
      assert.ok(schemaContent.includes("typeDefs"));
      assert.ok(schemaContent.includes("User"));
      assert.ok(schemaContent.includes("Post"));
      assert.ok(schemaContent.includes("Query"));

      const resolversContent = await readFile(
        join(outputDir, "resolvers.ts"),
        "utf-8",
      );
      assert.ok(resolversContent.includes("resolvers"));
      assert.ok(resolversContent.includes("Query"));
      assert.ok(resolversContent.includes("User"));
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
          interface User { id: string; }
          export type QueryResolver = { user: () => User };
          export const queryResolver: QueryResolver = { user: () => ({ id: "1" }) };
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

      assert.strictEqual(result.success, true);

      const schemaContent = await readFile(
        join(outputDir, "schema.ts"),
        "utf-8",
      );
      assert.ok(schemaContent.includes("import type { DocumentNode }"));
      assert.ok(schemaContent.includes("export const typeDefs"));
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
          interface User { id: string; name: string; }
          export type MutationResolver = {
            createUser: (args: { name: string }) => User;
          };
          export const mutationResolver: MutationResolver = {
            createUser: (args) => ({ id: "1", name: args.name }),
          };
        `,
        "utf-8",
      );

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          interface User { id: string; name: string; }
          export type QueryResolver = { users: () => User[] };
          export const queryResolver: QueryResolver = { users: () => [] };
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

      assert.strictEqual(result.success, true);

      const schemaContent = await readFile(
        join(outputDir, "schema.ts"),
        "utf-8",
      );
      assert.ok(schemaContent.includes("Mutation"));
      assert.ok(schemaContent.includes("createUser"));
    });
  });

  describe("error handling (Task 6.2)", () => {
    it("should fail when types directory does not exist", async () => {
      const resolversDir = join(testDir, "src/gql/resolvers");
      await mkdir(resolversDir, { recursive: true });

      await writeFile(
        join(resolversDir, "query.ts"),
        `
          export type QueryResolver = { user: () => User };
          export const queryResolver: QueryResolver = { user: () => ({} as User) };
          interface User { id: string; }
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

      assert.strictEqual(result.success, false);
      assert.ok(
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

      assert.strictEqual(result.success, false);
      assert.ok(
        result.diagnostics.some((d) => d.code === "DIRECTORY_NOT_FOUND"),
      );
    });

    it("should collect diagnostics for missing resolver value", async () => {
      const typesDir = join(testDir, "src/gql/types");
      const resolversDir = join(testDir, "src/gql/resolvers");

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
          interface User { id: string; }
          export type QueryResolver = { user: () => User };
        `,
        "utf-8",
      );

      const config: GenerationConfig = {
        cwd: testDir,
        typesDir,
        resolversDir,
        outputDir: join(testDir, "src/gqlkit/generated"),
      };

      const result = await executeGeneration(config);

      assert.strictEqual(result.success, false);
      assert.ok(
        result.diagnostics.some((d) => d.code === "MISSING_RESOLVER_VALUE"),
      );
    });

    it("should not write files when there are errors", async () => {
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
          interface User { id: string; }
          export type QueryResolver = { user: () => User };
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

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.filesWritten.length, 0);
    });
  });
});
