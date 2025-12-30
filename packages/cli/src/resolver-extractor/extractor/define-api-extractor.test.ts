import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ts from "typescript";
import { extractDefineApiResolvers } from "./define-api-extractor.js";

function createTestProgram(files: Record<string, string>): {
  program: ts.Program;
  filePaths: string[];
} {
  const fileNames = Object.keys(files);
  const compilerHost = ts.createCompilerHost({});

  const originalGetSourceFile = compilerHost.getSourceFile;
  compilerHost.getSourceFile = (
    fileName: string,
    languageVersion: ts.ScriptTarget,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean,
  ): ts.SourceFile | undefined => {
    const content = files[fileName];
    if (content !== undefined) {
      return ts.createSourceFile(fileName, content, languageVersion, true);
    }
    return originalGetSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
  };

  compilerHost.fileExists = (fileName: string): boolean => {
    return fileName in files || ts.sys.fileExists(fileName);
  };

  compilerHost.readFile = (fileName: string): string | undefined => {
    return files[fileName] ?? ts.sys.readFile(fileName);
  };

  const program = ts.createProgram(
    fileNames,
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.Node16,
      strict: true,
      noEmit: true,
    },
    compilerHost,
  );

  return { program, filePaths: fileNames };
}

describe("extractDefineApiResolvers", () => {
  describe("defineQuery detection", () => {
    it("should detect defineQuery export with NoArgs", () => {
      const { program, filePaths } = createTestProgram({
        "user.ts": `
          import { defineQuery, NoArgs } from "@gqlkit-ts/runtime";
          type User = { id: string; name: string };
          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1", name: "Me" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      const resolver = result.resolvers[0]!;
      assert.equal(resolver.fieldName, "me");
      assert.equal(resolver.resolverType, "query");
      assert.equal(resolver.parentTypeName, undefined);
      assert.equal(result.diagnostics.length, 0);
    });

    it("should detect defineQuery export with args", () => {
      const { program, filePaths } = createTestProgram({
        "user.ts": `
          import { defineQuery } from "@gqlkit-ts/runtime";
          type User = { id: string; name: string };
          type GetUserArgs = { id: string };
          export const user = defineQuery<GetUserArgs, User>(
            (root, args, ctx, info) => ({ id: args.id, name: "User" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      const resolver = result.resolvers[0]!;
      assert.equal(resolver.fieldName, "user");
      assert.equal(resolver.resolverType, "query");
      assert.ok(resolver.argsType);
      assert.equal(resolver.argsType.kind, "reference");
      assert.equal(resolver.argsType.name, "GetUserArgs");
    });

    it("should detect multiple defineQuery exports", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { defineQuery, NoArgs } from "@gqlkit-ts/runtime";
          type User = { id: string; name: string };
          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1", name: "Me" })
          );
          export const users = defineQuery<NoArgs, User[]>(
            (root, args, ctx, info) => []
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 2);
      assert.equal(result.resolvers[0]!.fieldName, "me");
      assert.equal(result.resolvers[1]!.fieldName, "users");
    });
  });

  describe("defineMutation detection", () => {
    it("should detect defineMutation export", () => {
      const { program, filePaths } = createTestProgram({
        "mutations.ts": `
          import { defineMutation } from "@gqlkit-ts/runtime";
          type User = { id: string; name: string };
          type CreateUserInput = { name: string };
          export const createUser = defineMutation<{ input: CreateUserInput }, User>(
            (root, args, ctx, info) => ({ id: "new", name: args.input.name })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      const resolver = result.resolvers[0]!;
      assert.equal(resolver.fieldName, "createUser");
      assert.equal(resolver.resolverType, "mutation");
      assert.equal(resolver.parentTypeName, undefined);
    });
  });

  describe("defineField detection", () => {
    it("should detect defineField export with parent type", () => {
      const { program, filePaths } = createTestProgram({
        "user-fields.ts": `
          import { defineField, NoArgs } from "@gqlkit-ts/runtime";
          type User = { id: string; firstName: string; lastName: string };
          export const fullName = defineField<User, NoArgs, string>(
            (parent, args, ctx, info) => parent.firstName + " " + parent.lastName
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      const resolver = result.resolvers[0]!;
      assert.equal(resolver.fieldName, "fullName");
      assert.equal(resolver.resolverType, "field");
      assert.equal(resolver.parentTypeName, "User");
    });

    it("should detect defineField export with args", () => {
      const { program, filePaths } = createTestProgram({
        "user-fields.ts": `
          import { defineField } from "@gqlkit-ts/runtime";
          type User = { id: string };
          type Post = { id: string; title: string };
          type PostsArgs = { limit: number };
          export const posts = defineField<User, PostsArgs, Post[]>(
            (parent, args, ctx, info) => []
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      const resolver = result.resolvers[0]!;
      assert.equal(resolver.fieldName, "posts");
      assert.equal(resolver.resolverType, "field");
      assert.equal(resolver.parentTypeName, "User");
      assert.ok(resolver.argsType);
      assert.equal(resolver.argsType.kind, "reference");
      assert.equal(resolver.argsType.name, "PostsArgs");
    });
  });

  describe("multiple files", () => {
    it("should extract resolvers from multiple files", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { defineQuery, NoArgs } from "@gqlkit-ts/runtime";
          type User = { id: string };
          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1" })
          );
        `,
        "mutations.ts": `
          import { defineMutation, NoArgs } from "@gqlkit-ts/runtime";
          type User = { id: string };
          export const deleteUser = defineMutation<{ id: string }, User>(
            (root, args, ctx, info) => ({ id: args.id })
          );
        `,
        "user-fields.ts": `
          import { defineField, NoArgs } from "@gqlkit-ts/runtime";
          type User = { id: string; name: string };
          export const displayName = defineField<User, NoArgs, string>(
            (parent, args, ctx, info) => parent.name
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 3);
      const types = result.resolvers.map((r) => r.resolverType);
      assert.ok(types.includes("query"));
      assert.ok(types.includes("mutation"));
      assert.ok(types.includes("field"));
    });
  });

  describe("non-define-api exports", () => {
    it("should ignore non-define-api exports", () => {
      const { program, filePaths } = createTestProgram({
        "mixed.ts": `
          import { defineQuery, NoArgs } from "@gqlkit-ts/runtime";
          type User = { id: string };

          // This should be detected
          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1" })
          );

          // These should be ignored
          export const someValue = { foo: "bar" };
          export type SomeType = { x: number };
          export function someFunction() { return 1; }
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      assert.equal(result.resolvers[0]!.fieldName, "me");
    });
  });

  describe("return type extraction", () => {
    it("should extract return type reference", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { defineQuery, NoArgs } from "@gqlkit-ts/runtime";
          type User = { id: string };
          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      const resolver = result.resolvers[0]!;
      assert.ok(resolver.returnType);
      assert.equal(resolver.returnType.kind, "reference");
      assert.equal(resolver.returnType.name, "User");
    });

    it("should extract array return type", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { defineQuery, NoArgs } from "@gqlkit-ts/runtime";
          type User = { id: string };
          export const users = defineQuery<NoArgs, User[]>(
            (root, args, ctx, info) => []
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      const resolver = result.resolvers[0]!;
      assert.ok(resolver.returnType);
      assert.equal(resolver.returnType.kind, "array");
      assert.ok(resolver.returnType.elementType);
      assert.equal(resolver.returnType.elementType.kind, "reference");
      assert.equal(resolver.returnType.elementType.name, "User");
    });

    it("should extract nullable return type", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { defineQuery } from "@gqlkit-ts/runtime";
          type User = { id: string };
          type GetUserArgs = { id: string };
          export const user = defineQuery<GetUserArgs, User | null>(
            (root, args, ctx, info) => null
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      const resolver = result.resolvers[0]!;
      assert.ok(resolver.returnType);
      assert.equal(resolver.returnType.nullable, true);
    });
  });

  describe("exported input types", () => {
    it("should detect exported input types", () => {
      const { program, filePaths } = createTestProgram({
        "mutations.ts": `
          import { defineMutation } from "@gqlkit-ts/runtime";
          type User = { id: string; name: string };
          export type CreateUserInput = { name: string; email: string };
          export const createUser = defineMutation<{ input: CreateUserInput }, User>(
            (root, args, ctx, info) => ({ id: "new", name: args.input.name })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      const resolver = result.resolvers[0]!;
      assert.ok(resolver.exportedInputTypes);
      assert.equal(resolver.exportedInputTypes.length, 1);
      assert.equal(resolver.exportedInputTypes[0]!.name, "CreateUserInput");
    });
  });

  describe("error cases", () => {
    it("should report diagnostic for complex define call expressions", () => {
      const { program, filePaths } = createTestProgram({
        "complex.ts": `
          import { defineQuery, NoArgs } from "@gqlkit-ts/runtime";
          type User = { id: string };
          const condition = true;
          export const me = condition
            ? defineQuery<NoArgs, User>((root, args, ctx, info) => ({ id: "1" }))
            : defineQuery<NoArgs, User>((root, args, ctx, info) => ({ id: "2" }));
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 0);
      assert.ok(result.diagnostics.length > 0);
      const diagnostic = result.diagnostics[0]!;
      assert.equal(diagnostic.code, "INVALID_DEFINE_CALL");
    });
  });
});
