import assert from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createProgramFromFiles } from "../../type-extractor/extractor/type-extractor.js";
import { extractResolversFromProgram } from "./resolver-extractor.js";

describe("ResolverExtractor", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "gqlkit-resolver-extractor-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Resolver type recognition (Requirement 2.1-2.5)", () => {
    it("should recognize exported types with *Resolver suffix", async () => {
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

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 1);
      assert.strictEqual(result.resolvers[0]?.typeName, "QueryResolver");
    });

    it("should recognize QueryResolver as query root resolver", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          users: () => string[];
        };
        export const queryResolver: QueryResolver = {
          users: () => [],
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 1);
      assert.strictEqual(result.resolvers[0]?.category, "query");
      assert.strictEqual(result.resolvers[0]?.targetTypeName, "Query");
    });

    it("should recognize MutationResolver as mutation root resolver", async () => {
      const filePath = join(tempDir, "mutation.ts");
      await writeFile(
        filePath,
        `
        export type MutationResolver = {
          createUser: () => string;
        };
        export const mutationResolver: MutationResolver = {
          createUser: () => "user-id",
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 1);
      assert.strictEqual(result.resolvers[0]?.category, "mutation");
      assert.strictEqual(result.resolvers[0]?.targetTypeName, "Mutation");
    });

    it("should recognize {TypeName}Resolver as type field resolver", async () => {
      const filePath = join(tempDir, "user.ts");
      await writeFile(
        filePath,
        `
        interface User { id: string; }
        export type UserResolver = {
          fullName: (parent: User) => string;
        };
        export const userResolver: UserResolver = {
          fullName: (parent) => parent.id,
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 1);
      assert.strictEqual(result.resolvers[0]?.category, "type");
      assert.strictEqual(result.resolvers[0]?.targetTypeName, "User");
    });

    it("should recognize interface as resolver type", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        export interface QueryResolver {
          hello: () => string;
        }
        export const queryResolver: QueryResolver = {
          hello: () => "world",
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 1);
      assert.strictEqual(result.resolvers[0]?.typeName, "QueryResolver");
    });

    it("should recognize type alias as resolver type", async () => {
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

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 1);
      assert.strictEqual(result.resolvers[0]?.typeName, "QueryResolver");
    });

    it("should ignore non-exported resolver types", async () => {
      const filePath = join(tempDir, "internal.ts");
      await writeFile(
        filePath,
        `
        type InternalResolver = {
          secret: () => string;
        };
        const internalResolver: InternalResolver = {
          secret: () => "hidden",
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 0);
    });

    it("should ignore types without *Resolver suffix", async () => {
      const filePath = join(tempDir, "types.ts");
      await writeFile(
        filePath,
        `
        export type User = {
          id: string;
        };
        export const user: User = {
          id: "1",
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 0);
    });
  });

  describe("Resolver value recognition and pairing (Requirement 3.1-3.5)", () => {
    it("should find matching camelCase value for resolver type", async () => {
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

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 1);
      assert.strictEqual(result.resolvers[0]?.valueName, "queryResolver");
    });

    it("should pair type and value exported from the same file", async () => {
      const filePath = join(tempDir, "user.ts");
      await writeFile(
        filePath,
        `
        interface User { id: string; }
        export type UserResolver = {
          fullName: (parent: User) => string;
        };
        export const userResolver: UserResolver = {
          fullName: (parent) => parent.id,
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 1);
      assert.strictEqual(result.resolvers[0]?.typeName, "UserResolver");
      assert.strictEqual(result.resolvers[0]?.valueName, "userResolver");
      assert.strictEqual(result.resolvers[0]?.sourceFile, filePath);
    });

    it("should return MISSING_RESOLVER_VALUE error when value is not found", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          hello: () => string;
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 0);
      assert.ok(
        result.diagnostics.some((d) => d.code === "MISSING_RESOLVER_VALUE"),
      );
    });

    it("should return MISSING_RESOLVER_TYPE error when type is not found for value", async () => {
      const filePath = join(tempDir, "orphan.ts");
      await writeFile(
        filePath,
        `
        export const orphanResolver = {
          hello: () => "world",
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.ok(
        result.diagnostics.some((d) => d.code === "MISSING_RESOLVER_TYPE"),
      );
    });

    it("should return NAMING_CONVENTION_MISMATCH error for mismatched naming", async () => {
      const filePath = join(tempDir, "mismatch.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          hello: () => string;
        };
        export const wrongNameResolver: QueryResolver = {
          hello: () => "world",
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.ok(
        result.diagnostics.some(
          (d) =>
            d.code === "MISSING_RESOLVER_VALUE" ||
            d.code === "NAMING_CONVENTION_MISMATCH",
        ),
      );
    });

    it("should handle multiple resolver pairs in the same file", async () => {
      const filePath = join(tempDir, "resolvers.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          hello: () => string;
        };
        export const queryResolver: QueryResolver = {
          hello: () => "world",
        };

        export type MutationResolver = {
          create: () => string;
        };
        export const mutationResolver: MutationResolver = {
          create: () => "created",
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 2);
      assert.ok(result.resolvers.some((r) => r.typeName === "QueryResolver"));
      assert.ok(
        result.resolvers.some((r) => r.typeName === "MutationResolver"),
      );
    });

    it("should handle resolver pairs across multiple files", async () => {
      const queryFile = join(tempDir, "query.ts");
      const mutationFile = join(tempDir, "mutation.ts");

      await writeFile(
        queryFile,
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
        mutationFile,
        `
        export type MutationResolver = {
          create: () => string;
        };
        export const mutationResolver: MutationResolver = {
          create: () => "created",
        };
        `,
      );

      const program = createProgramFromFiles([queryFile, mutationFile]);
      const result = extractResolversFromProgram(program, [
        queryFile,
        mutationFile,
      ]);

      assert.strictEqual(result.resolvers.length, 2);
      assert.ok(result.resolvers.some((r) => r.sourceFile === queryFile));
      assert.ok(result.resolvers.some((r) => r.sourceFile === mutationFile));
    });
  });

  describe("edge cases", () => {
    it("should handle empty files", async () => {
      const filePath = join(tempDir, "empty.ts");
      await writeFile(filePath, "");

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 0);
      assert.strictEqual(result.diagnostics.length, 0);
    });

    it("should include source file path in resolver pair", async () => {
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

      const program = createProgramFromFiles([filePath]);
      const result = extractResolversFromProgram(program, [filePath]);

      assert.strictEqual(result.resolvers.length, 1);
      assert.strictEqual(result.resolvers[0]?.sourceFile, filePath);
    });
  });
});
