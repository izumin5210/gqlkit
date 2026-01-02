import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path, { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractResolvers } from "./extract-resolvers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME_PACKAGE_PATH = resolve(__dirname, "../../../runtime");

describe("extractResolvers", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "gqlkit-extract-resolvers-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // TODO: These tests require @gqlkit-ts/runtime to be resolvable from the temp directory.
  // TypeScript module resolution cannot find the package when tests run in /tmp.
  // The resolver extraction itself is tested via E2E tests in examples/.
  describe.skip("basic extraction", () => {
    it("should extract resolvers from a directory", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        const { defineQuery } = createGqlkitApis<Context>();
        export const hello = defineQuery<NoArgs, string>(function() { return "world"; });
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      expect(result.queryFields.fields.length).toBe(1);
      expect(result.queryFields.fields[0]?.name).toBe("hello");
      expect(result.diagnostics.errors.length).toBe(0);
    });

    it("should extract Query, Mutation, and type resolvers", async () => {
      await mkdir(join(tempDir, "resolvers"), { recursive: true });

      await writeFile(
        join(tempDir, "resolvers", "query.ts"),
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        const { defineQuery } = createGqlkitApis<Context>();
        export const users = defineQuery<NoArgs, string[]>(function() { return []; });
        `,
      );

      await writeFile(
        join(tempDir, "resolvers", "mutation.ts"),
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        const { defineMutation } = createGqlkitApis<Context>();
        export const createUser = defineMutation<NoArgs, string>(function() { return "user-id"; });
        `,
      );

      await writeFile(
        join(tempDir, "resolvers", "user.ts"),
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        interface User { id: string; firstName: string; lastName: string; }
        const { defineField } = createGqlkitApis<Context>();
        export const fullName = defineField<User, NoArgs, string>(
          function(parent) { return parent.firstName + " " + parent.lastName; }
        );
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      expect(result.queryFields.fields.length).toBe(1);
      expect(result.mutationFields.fields.length).toBe(1);
      expect(result.typeExtensions.length).toBe(1);
      expect(result.typeExtensions[0]?.targetTypeName).toBe("User");
    });
  });

  describe("error handling (Requirement 7.4)", () => {
    it("should return DIRECTORY_NOT_FOUND for non-existent directory", async () => {
      const result = await extractResolvers({
        directory: join(tempDir, "non-existent"),
      });

      expect(result.diagnostics.errors.length).toBe(1);
      expect(result.diagnostics.errors[0]?.code).toBe("DIRECTORY_NOT_FOUND");
    });

    it("should return empty result for empty directory", async () => {
      const result = await extractResolvers({ directory: tempDir });

      expect(result.queryFields.fields.length).toBe(0);
      expect(result.mutationFields.fields.length).toBe(0);
      expect(result.typeExtensions.length).toBe(0);
      expect(result.diagnostics.errors.length).toBe(0);
    });
  });

  // TODO: Requires @gqlkit-ts/runtime resolution (see basic extraction comment)
  describe.skip("output structure (Requirement 7.1, 7.2, 7.3)", () => {
    it("should separate Query, Mutation, and type extensions", async () => {
      await writeFile(
        join(tempDir, "all.ts"),
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        interface User { id: string; }
        const { defineQuery, defineMutation, defineField } = createGqlkitApis<Context>();
        export const query = defineQuery<NoArgs, string>(function() { return "q"; });
        export const mutation = defineMutation<NoArgs, string>(function() { return "m"; });
        export const name = defineField<User, NoArgs, string>(function() { return "user"; });
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      expect(result.queryFields.fields.length > 0).toBe(true);
      expect(result.mutationFields.fields.length > 0).toBe(true);
      expect(result.typeExtensions.length > 0).toBe(true);
    });

    it("should include source file location in field definitions", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        const { defineQuery } = createGqlkitApis<Context>();
        export const hello = defineQuery<NoArgs, string>(function() { return "world"; });
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      expect(result.queryFields.fields[0]?.sourceLocation).toBeTruthy();
      expect(result.queryFields.fields[0]?.sourceLocation.file).toBe(filePath);
    });

    it("should separate errors and warnings in diagnostics", async () => {
      const result = await extractResolvers({ directory: tempDir });

      expect(Array.isArray(result.diagnostics.errors)).toBe(true);
      expect(Array.isArray(result.diagnostics.warnings)).toBe(true);
    });
  });

  // TODO: Requires @gqlkit-ts/runtime resolution (see basic extraction comment)
  describe.skip("deterministic output", () => {
    it("should produce same output for same input", async () => {
      await writeFile(
        join(tempDir, "zebra.ts"),
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        interface Zebra { id: string; }
        const { defineField } = createGqlkitApis<Context>();
        export const name = defineField<Zebra, NoArgs, string>(function() { return "z"; });
        `,
      );
      await writeFile(
        join(tempDir, "apple.ts"),
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        interface Apple { id: string; }
        const { defineField } = createGqlkitApis<Context>();
        export const name = defineField<Apple, NoArgs, string>(function() { return "a"; });
        `,
      );

      const result1 = await extractResolvers({ directory: tempDir });
      const result2 = await extractResolvers({ directory: tempDir });

      expect(result1).toEqual(result2);
    });
  });

  // TODO: Requires @gqlkit-ts/runtime resolution (see basic extraction comment)
  describe.skip("integration with type-extractor format (Requirement 7.5)", () => {
    it("should return a result with diagnostics object", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        const { defineQuery } = createGqlkitApis<Context>();
        export const hello = defineQuery<NoArgs, string>(function() { return "world"; });
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      expect("diagnostics" in result).toBe(true);
      expect("errors" in result.diagnostics).toBe(true);
      expect("warnings" in result.diagnostics).toBe(true);
    });
  });

  // TODO: Requires @gqlkit-ts/runtime resolution (see basic extraction comment)
  describe.skip("define* API support", () => {
    it("should extract Query resolver from defineQuery", async () => {
      await writeFile(
        join(tempDir, "queries.ts"),
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        type User = { id: string; name: string };
        const { defineQuery } = createGqlkitApis<Context>();
        export const me = defineQuery<NoArgs, User>(
          function() { return { id: "1", name: "Me" }; }
        );
        export const users = defineQuery<NoArgs, User[]>(
          function() { return []; }
        );
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      expect(result.diagnostics.errors.length).toBe(0);
      expect(result.queryFields.fields.length).toBe(2);
      const fieldNames = result.queryFields.fields.map((f) => f.name);
      expect(fieldNames.includes("me")).toBe(true);
      expect(fieldNames.includes("users")).toBe(true);
    });

    it("should extract Mutation resolver from defineMutation", async () => {
      await writeFile(
        join(tempDir, "mutations.ts"),
        `
        import { createGqlkitApis } from "@gqlkit-ts/runtime";
        type Context = unknown;
        type User = { id: string; name: string };
        type CreateUserInput = { name: string };
        const { defineMutation } = createGqlkitApis<Context>();
        export const createUser = defineMutation<{ input: CreateUserInput }, User>(
          function(_root, args) { return { id: "new", name: args.input.name }; }
        );
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      expect(result.diagnostics.errors.length).toBe(0);
      expect(result.mutationFields.fields.length).toBe(1);
      expect(result.mutationFields.fields[0]?.name).toBe("createUser");
    });

    it("should extract type field resolver from defineField", async () => {
      await writeFile(
        join(tempDir, "user-fields.ts"),
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        type User = { id: string; firstName: string; lastName: string };
        const { defineField } = createGqlkitApis<Context>();
        export const fullName = defineField<User, NoArgs, string>(
          function(parent) { return parent.firstName + " " + parent.lastName; }
        );
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      expect(result.diagnostics.errors.length).toBe(0);
      expect(result.typeExtensions.length).toBe(1);
      expect(result.typeExtensions[0]?.targetTypeName).toBe("User");
      expect(result.typeExtensions[0]?.fields.length).toBe(1);
      expect(result.typeExtensions[0]?.fields[0]?.name).toBe("fullName");
    });

    it("should extract resolver with args", async () => {
      await writeFile(
        join(tempDir, "queries.ts"),
        `
        import { createGqlkitApis } from "@gqlkit-ts/runtime";
        type Context = unknown;
        type User = { id: string; name: string };
        const { defineQuery } = createGqlkitApis<Context>();
        export const user = defineQuery<{ id: string }, User | null>(
          function() { return null; }
        );
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      expect(result.diagnostics.errors.length).toBe(0);
      expect(result.queryFields.fields.length).toBe(1);
      expect(result.queryFields.fields[0]?.name).toBe("user");
      expect(result.queryFields.fields[0]?.args).toBeTruthy();
      expect(result.queryFields.fields[0]?.args?.length).toBe(1);
      expect(result.queryFields.fields[0]?.args?.[0]?.name).toBe("id");
    });
  });

  // TODO: Requires @gqlkit-ts/runtime resolution (see basic extraction comment)
  // The first test uses paths config pointing to local source, which is a development-time hack.
  describe.skip("external Program support", () => {
    const RUNTIME_SOURCE_PATH = path.resolve(
      __dirname,
      "../../../runtime/src/index.ts",
    );

    it("should use external Program when provided", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        const { defineQuery } = createGqlkitApis<Context>();
        export const hello = defineQuery<NoArgs, string>(function() { return "world"; });
        `,
      );

      const program = ts.createProgram([filePath], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.Node16,
        strict: true,
        baseUrl: __dirname,
        paths: {
          "@gqlkit-ts/runtime": [RUNTIME_SOURCE_PATH],
        },
      });

      const result = await extractResolvers({
        directory: tempDir,
        program,
      });

      expect(result.queryFields.fields.length).toBe(1);
      expect(result.queryFields.fields[0]?.name).toBe("hello");
    });

    it("should create internal Program when not provided (backward compatibility)", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        const { defineQuery } = createGqlkitApis<Context>();
        export const hello = defineQuery<NoArgs, string>(function() { return "world"; });
        `,
      );

      const result = await extractResolvers({
        directory: tempDir,
        program: null,
      });

      expect(result.queryFields.fields.length).toBe(1);
      expect(result.queryFields.fields[0]?.name).toBe("hello");
    });

    it("should work without program parameter (backward compatibility)", async () => {
      await writeFile(
        join(tempDir, "query.ts"),
        `
        import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
        type Context = unknown;
        const { defineQuery } = createGqlkitApis<Context>();
        export const hello = defineQuery<NoArgs, string>(function() { return "world"; });
        `,
      );

      const result = await extractResolvers({ directory: tempDir });

      expect(result.queryFields.fields.length).toBe(1);
      expect(result.queryFields.fields[0]?.name).toBe("hello");
    });
  });
});
