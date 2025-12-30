import assert from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createProgramFromFiles } from "../../type-extractor/extractor/type-extractor.js";
import { extractResolversFromProgram } from "../extractor/resolver-extractor.js";
import { analyzeSignatures } from "./signature-analyzer.js";

describe("SignatureAnalyzer", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "gqlkit-signature-analyzer-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Query/Mutation signature analysis (Requirement 4.1-4.3, 4.9)", () => {
    it("should identify function type properties", async () => {
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
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.strictEqual(result.resolvers.length, 1);
      assert.strictEqual(result.resolvers[0]?.fields.length, 1);
      assert.strictEqual(result.resolvers[0]?.fields[0]?.name, "hello");
    });

    it("should recognize () => ReturnType as no-args root field", async () => {
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
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.strictEqual(result.resolvers[0]?.fields[0]?.args, undefined);
      assert.strictEqual(result.resolvers[0]?.fields[0]?.parentType, undefined);
    });

    it("should recognize (args: ArgsType) => ReturnType for Query", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        type UserArgs = { id: string };
        export type QueryResolver = {
          user: (args: UserArgs) => string;
        };
        export const queryResolver: QueryResolver = {
          user: (args) => args.id,
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.ok(result.resolvers[0]?.fields[0]?.args);
      assert.strictEqual(result.resolvers[0]?.fields[0]?.args?.length, 1);
      assert.strictEqual(result.resolvers[0]?.fields[0]?.args?.[0]?.name, "id");
    });

    it("should report INVALID_RESOLVER_SIGNATURE for non-function properties", async () => {
      const filePath = join(tempDir, "invalid.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          notAFunction: string;
        };
        export const queryResolver: QueryResolver = {
          notAFunction: "value",
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.ok(
        result.diagnostics.some((d) => d.code === "INVALID_RESOLVER_SIGNATURE"),
      );
    });
  });

  describe("Type resolver signature analysis (Requirement 4.4-4.5, 4.9)", () => {
    it("should recognize (parent: ParentType) => ReturnType", async () => {
      const filePath = join(tempDir, "user.ts");
      await writeFile(
        filePath,
        `
        interface User { firstName: string; lastName: string; }
        export type UserResolver = {
          fullName: (parent: User) => string;
        };
        export const userResolver: UserResolver = {
          fullName: (parent) => parent.firstName + " " + parent.lastName,
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.ok(result.resolvers[0]?.fields[0]?.parentType);
      assert.strictEqual(
        result.resolvers[0]?.fields[0]?.parentType?.name,
        "User",
      );
      assert.strictEqual(result.resolvers[0]?.fields[0]?.args, undefined);
    });

    it("should recognize (parent: ParentType, args: ArgsType) => ReturnType", async () => {
      const filePath = join(tempDir, "user.ts");
      await writeFile(
        filePath,
        `
        interface User { id: string; }
        type PostsArgs = { limit: number };
        export type UserResolver = {
          posts: (parent: User, args: PostsArgs) => string[];
        };
        export const userResolver: UserResolver = {
          posts: (parent, args) => [],
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.ok(result.resolvers[0]?.fields[0]?.parentType);
      assert.ok(result.resolvers[0]?.fields[0]?.args);
      assert.strictEqual(result.resolvers[0]?.fields[0]?.args?.length, 1);
      assert.strictEqual(
        result.resolvers[0]?.fields[0]?.args?.[0]?.name,
        "limit",
      );
    });

    it("should report PARENT_TYPE_MISMATCH when parent type does not match", async () => {
      const filePath = join(tempDir, "user.ts");
      await writeFile(
        filePath,
        `
        interface Post { id: string; }
        export type UserResolver = {
          posts: (parent: Post) => string[];
        };
        export const userResolver: UserResolver = {
          posts: (parent) => [],
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.ok(
        result.diagnostics.some((d) => d.code === "PARENT_TYPE_MISMATCH"),
      );
    });
  });

  describe("Argument and return type analysis (Requirement 4.6-4.8)", () => {
    it("should extract args type properties as GraphQL InputValue", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        type CreateUserArgs = {
          name: string;
          email: string;
          age?: number;
        };
        export type MutationResolver = {
          createUser: (args: CreateUserArgs) => string;
        };
        export const mutationResolver: MutationResolver = {
          createUser: (args) => "user-id",
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      const args = result.resolvers[0]?.fields[0]?.args;
      assert.ok(args);
      assert.strictEqual(args.length, 3);
      assert.ok(args.some((a) => a.name === "name" && !a.optional));
      assert.ok(args.some((a) => a.name === "email" && !a.optional));
      assert.ok(args.some((a) => a.name === "age" && a.optional));
    });

    it("should infer nullable from T | null return type", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          maybeUser: () => string | null;
        };
        export const queryResolver: QueryResolver = {
          maybeUser: () => null,
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.strictEqual(
        result.resolvers[0]?.fields[0]?.returnType.nullable,
        true,
      );
    });

    it("should infer list from array return type", async () => {
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
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.strictEqual(
        result.resolvers[0]?.fields[0]?.returnType.kind,
        "array",
      );
    });

    it("should unwrap Promise<T> to T for return type", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          asyncUser: () => Promise<string>;
        };
        export const queryResolver: QueryResolver = {
          asyncUser: async () => "user",
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.strictEqual(
        result.resolvers[0]?.fields[0]?.returnType.kind,
        "primitive",
      );
      assert.strictEqual(
        result.resolvers[0]?.fields[0]?.returnType.name,
        "string",
      );
    });

    it("should unwrap Promise<T | null> to nullable T", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          maybeAsyncUser: () => Promise<string | null>;
        };
        export const queryResolver: QueryResolver = {
          maybeAsyncUser: async () => null,
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.strictEqual(
        result.resolvers[0]?.fields[0]?.returnType.nullable,
        true,
      );
      assert.strictEqual(
        result.resolvers[0]?.fields[0]?.returnType.name,
        "string",
      );
    });
  });

  describe("edge cases", () => {
    it("should handle multiple fields in a resolver", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          hello: () => string;
          users: () => string[];
          count: () => number;
        };
        export const queryResolver: QueryResolver = {
          hello: () => "world",
          users: () => [],
          count: () => 0,
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.strictEqual(result.resolvers[0]?.fields.length, 3);
    });

    it("should handle type reference in return type", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        interface User { id: string; }
        export type QueryResolver = {
          user: () => User;
        };
        export const queryResolver: QueryResolver = {
          user: () => ({ id: "1" }),
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const result = analyzeSignatures(extracted, checker);

      assert.strictEqual(
        result.resolvers[0]?.fields[0]?.returnType.kind,
        "reference",
      );
      assert.strictEqual(
        result.resolvers[0]?.fields[0]?.returnType.name,
        "User",
      );
    });
  });
});
