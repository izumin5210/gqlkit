import assert from "node:assert";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { extractResolvers } from "./extract-resolvers.js";

describe("extractResolvers", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "gqlkit-extract-resolvers-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("basic extraction", () => {
    it("should extract resolvers from a directory", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        `
        export type QueryResolver = {
          hello: () => string;
        };
        export const queryResolver: QueryResolver = {
          hello: () => "world",
        };
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      assert.strictEqual(result.queryFields.fields.length, 1);
      assert.strictEqual(result.queryFields.fields[0]?.name, "hello");
      assert.strictEqual(result.diagnostics.errors.length, 0);
    });

    it("should extract Query, Mutation, and type resolvers", async () => {
      await mkdir(join(tempDir, "resolvers"), { recursive: true });

      await writeFile(
        join(tempDir, "resolvers", "query.ts"),
        `
        export type QueryResolver = {
          users: () => string[];
        };
        export const queryResolver: QueryResolver = {
          users: () => [],
        };
        `,
      );

      await writeFile(
        join(tempDir, "resolvers", "mutation.ts"),
        `
        export type MutationResolver = {
          createUser: () => string;
        };
        export const mutationResolver: MutationResolver = {
          createUser: () => "user-id",
        };
        `,
      );

      await writeFile(
        join(tempDir, "resolvers", "user.ts"),
        `
        interface User { id: string; firstName: string; lastName: string; }
        export type UserResolver = {
          fullName: (parent: User) => string;
        };
        export const userResolver: UserResolver = {
          fullName: (parent) => parent.firstName + " " + parent.lastName,
        };
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      assert.strictEqual(result.queryFields.fields.length, 1);
      assert.strictEqual(result.mutationFields.fields.length, 1);
      assert.strictEqual(result.typeExtensions.length, 1);
      assert.strictEqual(result.typeExtensions[0]?.targetTypeName, "User");
    });
  });

  describe("error handling (Requirement 7.4)", () => {
    it("should return DIRECTORY_NOT_FOUND for non-existent directory", async () => {
      const result = await extractResolvers({
        directory: join(tempDir, "non-existent"),
      });

      assert.strictEqual(result.diagnostics.errors.length, 1);
      assert.strictEqual(
        result.diagnostics.errors[0]?.code,
        "DIRECTORY_NOT_FOUND",
      );
    });

    it("should return empty result for empty directory", async () => {
      const result = await extractResolvers({ directory: tempDir });

      assert.strictEqual(result.queryFields.fields.length, 0);
      assert.strictEqual(result.mutationFields.fields.length, 0);
      assert.strictEqual(result.typeExtensions.length, 0);
      assert.strictEqual(result.diagnostics.errors.length, 0);
    });

    it("should return partial results with errors", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        `
        export type QueryResolver = {
          hello: () => string;
        };
        export const queryResolver: QueryResolver = {
          hello: () => "world",
        };
        `,
      );

      await writeFile(
        join(tempDir, "orphan.ts"),
        `
        export const orphanResolver = {
          missing: () => "no type",
        };
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      assert.strictEqual(result.queryFields.fields.length, 1);
      assert.ok(result.diagnostics.errors.length > 0);
    });
  });

  describe("output structure (Requirement 7.1, 7.2, 7.3)", () => {
    it("should separate Query, Mutation, and type extensions", async () => {
      await writeFile(
        join(tempDir, "all.ts"),
        `
        export type QueryResolver = {
          query: () => string;
        };
        export const queryResolver: QueryResolver = {
          query: () => "q",
        };
        export type MutationResolver = {
          mutation: () => string;
        };
        export const mutationResolver: MutationResolver = {
          mutation: () => "m",
        };
        interface User { id: string; }
        export type UserResolver = {
          name: (parent: User) => string;
        };
        export const userResolver: UserResolver = {
          name: (parent) => "user",
        };
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      assert.ok(result.queryFields.fields.length > 0);
      assert.ok(result.mutationFields.fields.length > 0);
      assert.ok(result.typeExtensions.length > 0);
    });

    it("should include source file location in field definitions", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          hello: () => string;
        };
        export const queryResolver: QueryResolver = {
          hello: () => "world",
        };
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      assert.ok(result.queryFields.fields[0]?.sourceLocation);
      assert.strictEqual(
        result.queryFields.fields[0]?.sourceLocation.file,
        filePath,
      );
    });

    it("should separate errors and warnings in diagnostics", async () => {
      await writeFile(
        join(tempDir, "orphan.ts"),
        `
        export const orphanResolver = {
          missing: () => "no type",
        };
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      assert.ok(Array.isArray(result.diagnostics.errors));
      assert.ok(Array.isArray(result.diagnostics.warnings));
    });
  });

  describe("deterministic output", () => {
    it("should produce same output for same input", async () => {
      await writeFile(
        join(tempDir, "zebra.ts"),
        `
        interface Zebra { id: string; }
        export type ZebraResolver = { name: (parent: Zebra) => string; };
        export const zebraResolver: ZebraResolver = { name: (p) => "z" };
        `,
      );
      await writeFile(
        join(tempDir, "apple.ts"),
        `
        interface Apple { id: string; }
        export type AppleResolver = { name: (parent: Apple) => string; };
        export const appleResolver: AppleResolver = { name: (p) => "a" };
        `,
      );

      const result1 = await extractResolvers({ directory: tempDir });
      const result2 = await extractResolvers({ directory: tempDir });

      assert.deepStrictEqual(result1, result2);
    });
  });

  describe("integration with type-extractor format (Requirement 7.5)", () => {
    it("should return a result with diagnostics object", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        `
        export type QueryResolver = {
          hello: () => string;
        };
        export const queryResolver: QueryResolver = {
          hello: () => "world",
        };
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      assert.ok("diagnostics" in result);
      assert.ok("errors" in result.diagnostics);
      assert.ok("warnings" in result.diagnostics);
    });
  });

  describe("define* API support", () => {
    it("should extract Query resolver from defineQuery", async () => {
      await writeFile(
        join(tempDir, "queries.ts"),
        `
        import { defineQuery, NoArgs } from "@gqlkit-ts/runtime";
        type User = { id: string; name: string };
        export const me = defineQuery<NoArgs, User>(
          (root, args, ctx, info) => ({ id: "1", name: "Me" })
        );
        export const users = defineQuery<NoArgs, User[]>(
          (root, args, ctx, info) => []
        );
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      assert.strictEqual(result.diagnostics.errors.length, 0);
      assert.strictEqual(result.queryFields.fields.length, 2);
      const fieldNames = result.queryFields.fields.map((f) => f.name);
      assert.ok(fieldNames.includes("me"));
      assert.ok(fieldNames.includes("users"));
    });

    it("should extract Mutation resolver from defineMutation", async () => {
      await writeFile(
        join(tempDir, "mutations.ts"),
        `
        import { defineMutation } from "@gqlkit-ts/runtime";
        type User = { id: string; name: string };
        type CreateUserInput = { name: string };
        export const createUser = defineMutation<{ input: CreateUserInput }, User>(
          (root, args, ctx, info) => ({ id: "new", name: args.input.name })
        );
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      assert.strictEqual(result.diagnostics.errors.length, 0);
      assert.strictEqual(result.mutationFields.fields.length, 1);
      assert.strictEqual(result.mutationFields.fields[0]?.name, "createUser");
    });

    it("should extract type field resolver from defineField", async () => {
      await writeFile(
        join(tempDir, "user-fields.ts"),
        `
        import { defineField, NoArgs } from "@gqlkit-ts/runtime";
        type User = { id: string; firstName: string; lastName: string };
        export const fullName = defineField<User, NoArgs, string>(
          (parent, args, ctx, info) => parent.firstName + " " + parent.lastName
        );
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      assert.strictEqual(result.diagnostics.errors.length, 0);
      assert.strictEqual(result.typeExtensions.length, 1);
      assert.strictEqual(result.typeExtensions[0]?.targetTypeName, "User");
      assert.strictEqual(result.typeExtensions[0]?.fields.length, 1);
      assert.strictEqual(result.typeExtensions[0]?.fields[0]?.name, "fullName");
    });

    it("should extract resolver with args", async () => {
      await writeFile(
        join(tempDir, "queries.ts"),
        `
        import { defineQuery } from "@gqlkit-ts/runtime";
        type User = { id: string; name: string };
        export const user = defineQuery<{ id: string }, User | null>(
          (root, args, ctx, info) => null
        );
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      assert.strictEqual(result.diagnostics.errors.length, 0);
      assert.strictEqual(result.queryFields.fields.length, 1);
      assert.strictEqual(result.queryFields.fields[0]?.name, "user");
      assert.ok(result.queryFields.fields[0]?.args);
      assert.strictEqual(result.queryFields.fields[0]?.args.length, 1);
      assert.strictEqual(result.queryFields.fields[0]?.args[0]?.name, "id");
    });
  });

  describe("mixed API detection", () => {
    it("should error when legacy and define* API are mixed", async () => {
      await writeFile(
        join(tempDir, "legacy.ts"),
        `
        export type QueryResolver = {
          hello: () => string;
        };
        export const queryResolver: QueryResolver = {
          hello: () => "world",
        };
        `,
      );

      await writeFile(
        join(tempDir, "define-api.ts"),
        `
        import { defineQuery, NoArgs } from "@gqlkit-ts/runtime";
        type User = { id: string };
        export const me = defineQuery<NoArgs, User>(
          (root, args, ctx, info) => ({ id: "1" })
        );
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      assert.ok(result.diagnostics.errors.length > 0);
      const mixedApiError = result.diagnostics.errors.find(
        (e) => e.code === "LEGACY_API_DETECTED",
      );
      assert.ok(mixedApiError);
    });
  });
});
