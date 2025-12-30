import assert from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createProgramFromFiles } from "../../type-extractor/extractor/type-extractor.js";
import { analyzeSignatures } from "../analyzer/signature-analyzer.js";
import { extractResolversFromProgram } from "../extractor/resolver-extractor.js";
import { convertToFields } from "./field-converter.js";

describe("FieldConverter", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "gqlkit-field-converter-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Scalar type conversion (Requirement 8.1-8.5)", () => {
    it("should convert TypeScript string to GraphQL String", async () => {
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
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(result.queryFields.fields[0]?.type.typeName, "String");
    });

    it("should convert TypeScript number to GraphQL Int", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          count: () => number;
        };
        export const queryResolver: QueryResolver = {
          count: () => 0,
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(result.queryFields.fields[0]?.type.typeName, "Int");
    });

    it("should convert TypeScript boolean to GraphQL Boolean", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          active: () => boolean;
        };
        export const queryResolver: QueryResolver = {
          active: () => true,
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(
        result.queryFields.fields[0]?.type.typeName,
        "Boolean",
      );
    });

    it("should interpret T | null as nullable field", async () => {
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
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(result.queryFields.fields[0]?.type.nullable, true);
    });

    it("should convert array type to GraphQL list type", async () => {
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
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(result.queryFields.fields[0]?.type.list, true);
      assert.strictEqual(result.queryFields.fields[0]?.type.typeName, "String");
    });

    it("should use type name as GraphQL type reference", async () => {
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
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(result.queryFields.fields[0]?.type.typeName, "User");
    });
  });

  describe("Query/Mutation field definition (Requirement 5.1-5.5)", () => {
    it("should generate Query field definitions from QueryResolver", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          hello: () => string;
          users: () => string[];
        };
        export const queryResolver: QueryResolver = {
          hello: () => "world",
          users: () => [],
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(result.queryFields.fields.length, 2);
      assert.ok(result.queryFields.fields.some((f) => f.name === "hello"));
      assert.ok(result.queryFields.fields.some((f) => f.name === "users"));
    });

    it("should generate Mutation field definitions from MutationResolver", async () => {
      const filePath = join(tempDir, "mutation.ts");
      await writeFile(
        filePath,
        `
        export type MutationResolver = {
          createUser: () => string;
          deleteUser: () => boolean;
        };
        export const mutationResolver: MutationResolver = {
          createUser: () => "user-id",
          deleteUser: () => true,
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(result.mutationFields.fields.length, 2);
      assert.ok(
        result.mutationFields.fields.some((f) => f.name === "createUser"),
      );
      assert.ok(
        result.mutationFields.fields.some((f) => f.name === "deleteUser"),
      );
    });

    it("should use field name as GraphQL field name", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        export type QueryResolver = {
          userById: () => string;
        };
        export const queryResolver: QueryResolver = {
          userById: () => "user",
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(result.queryFields.fields[0]?.name, "userById");
    });

    it("should include args in field definition", async () => {
      const filePath = join(tempDir, "query.ts");
      await writeFile(
        filePath,
        `
        type UserArgs = { id: string; name?: string };
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
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      const args = result.queryFields.fields[0]?.args;
      assert.ok(args);
      assert.strictEqual(args.length, 2);
      assert.ok(args.some((a) => a.name === "id"));
      assert.ok(args.some((a) => a.name === "name"));
    });
  });

  describe("Type extension field definition (Requirement 6.1-6.4)", () => {
    it("should generate type extension from {TypeName}Resolver", async () => {
      const filePath = join(tempDir, "user.ts");
      await writeFile(
        filePath,
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

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(result.typeExtensions.length, 1);
      assert.strictEqual(result.typeExtensions[0]?.targetTypeName, "User");
      assert.strictEqual(result.typeExtensions[0]?.fields.length, 1);
      assert.strictEqual(result.typeExtensions[0]?.fields[0]?.name, "fullName");
    });

    it("should convert return type to GraphQL type", async () => {
      const filePath = join(tempDir, "user.ts");
      await writeFile(
        filePath,
        `
        interface User { id: string; }
        interface Post { id: string; }
        export type UserResolver = {
          posts: (parent: User) => Post[];
        };
        export const userResolver: UserResolver = {
          posts: (parent) => [],
        };
        `,
      );

      const program = createProgramFromFiles([filePath]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [filePath]);
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(result.typeExtensions[0]?.fields[0]?.type.list, true);
      assert.strictEqual(
        result.typeExtensions[0]?.fields[0]?.type.typeName,
        "Post",
      );
    });

    it("should include args in type extension field", async () => {
      const filePath = join(tempDir, "user.ts");
      await writeFile(
        filePath,
        `
        interface User { id: string; }
        type PostsArgs = { limit: number; offset?: number };
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
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      const args = result.typeExtensions[0]?.fields[0]?.args;
      assert.ok(args);
      assert.strictEqual(args.length, 2);
      assert.ok(args.some((a) => a.name === "limit"));
      assert.ok(args.some((a) => a.name === "offset"));
    });
  });

  describe("Source location (Requirement 7.2)", () => {
    it("should include source file location in field definition", async () => {
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
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.ok(result.queryFields.fields[0]?.sourceLocation);
      assert.strictEqual(
        result.queryFields.fields[0]?.sourceLocation.file,
        filePath,
      );
    });
  });

  describe("edge cases", () => {
    it("should handle both Query and Mutation in separate files", async () => {
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
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [
        queryFile,
        mutationFile,
      ]);
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(result.queryFields.fields.length, 1);
      assert.strictEqual(result.mutationFields.fields.length, 1);
    });

    it("should handle multiple type resolvers", async () => {
      const userFile = join(tempDir, "user.ts");
      const postFile = join(tempDir, "post.ts");

      await writeFile(
        userFile,
        `
        interface User { id: string; }
        export type UserResolver = {
          name: (parent: User) => string;
        };
        export const userResolver: UserResolver = {
          name: (parent) => "User Name",
        };
        `,
      );

      await writeFile(
        postFile,
        `
        interface Post { id: string; }
        export type PostResolver = {
          title: (parent: Post) => string;
        };
        export const postResolver: PostResolver = {
          title: (parent) => "Post Title",
        };
        `,
      );

      const program = createProgramFromFiles([userFile, postFile]);
      const checker = program.getTypeChecker();
      const extracted = extractResolversFromProgram(program, [
        userFile,
        postFile,
      ]);
      const analyzed = analyzeSignatures(extracted, checker);
      const result = convertToFields(analyzed);

      assert.strictEqual(result.typeExtensions.length, 2);
      assert.ok(result.typeExtensions.some((e) => e.targetTypeName === "User"));
      assert.ok(result.typeExtensions.some((e) => e.targetTypeName === "Post"));
    });
  });
});
