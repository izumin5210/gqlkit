import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { extractDefineApiResolvers } from "./define-api-extractor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_SOURCE_PATH = path.resolve(
  __dirname,
  "../../../../runtime/src/index.ts",
);
const VIRTUAL_ROOT = "/virtual";

function createTestProgram(files: Record<string, string>): {
  program: ts.Program;
  filePaths: string[];
} {
  const absoluteFiles: Record<string, string> = {};
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(VIRTUAL_ROOT, relativePath);
    absoluteFiles[absolutePath] = content;
  }

  const fileNames = Object.keys(absoluteFiles);

  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    strict: true,
    noEmit: true,
    baseUrl: VIRTUAL_ROOT,
    paths: {
      "@gqlkit-ts/runtime": [RUNTIME_SOURCE_PATH],
    },
  };

  const compilerHost = ts.createCompilerHost(options);

  const originalGetSourceFile = compilerHost.getSourceFile;
  compilerHost.getSourceFile = (
    fileName: string,
    languageVersion: ts.ScriptTarget,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean,
  ): ts.SourceFile | undefined => {
    const content = absoluteFiles[fileName];
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

  const originalFileExists = compilerHost.fileExists;
  compilerHost.fileExists = (fileName: string): boolean => {
    if (fileName in absoluteFiles) return true;
    const tsFileName = fileName.replace(/\.js$/, ".ts");
    if (tsFileName in absoluteFiles) return true;
    return originalFileExists(fileName);
  };

  const originalReadFile = compilerHost.readFile;
  compilerHost.readFile = (fileName: string): string | undefined => {
    if (fileName in absoluteFiles) return absoluteFiles[fileName];
    const tsFileName = fileName.replace(/\.js$/, ".ts");
    if (tsFileName in absoluteFiles) return absoluteFiles[tsFileName];
    return originalReadFile(fileName);
  };

  compilerHost.resolveModuleNames = (
    moduleNames: string[],
    containingFile: string,
  ): (ts.ResolvedModule | undefined)[] => {
    return moduleNames.map((moduleName) => {
      if (moduleName === "@gqlkit-ts/runtime") {
        return {
          resolvedFileName: RUNTIME_SOURCE_PATH,
          isExternalLibraryImport: false,
        };
      }

      if (moduleName.startsWith(".")) {
        const dir = path.dirname(containingFile);
        let resolvedPath = path.resolve(dir, moduleName);
        if (resolvedPath.endsWith(".js")) {
          resolvedPath = resolvedPath.replace(/\.js$/, ".ts");
        }
        if (resolvedPath in absoluteFiles) {
          return {
            resolvedFileName: resolvedPath,
            isExternalLibraryImport: false,
          };
        }
      }

      const result = ts.resolveModuleName(
        moduleName,
        containingFile,
        options,
        compilerHost,
      );
      return result.resolvedModule;
    });
  };

  const program = ts.createProgram(fileNames, options, compilerHost);

  return { program, filePaths: fileNames };
}

describe("extractDefineApiResolvers", () => {
  describe("defineQuery detection", () => {
    it("should detect defineQuery export with NoArgs", () => {
      const { program, filePaths } = createTestProgram({
        "user.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineQuery } = createGqlkitApis<Context>();
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
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          type GetUserArgs = { id: string };
          const { defineQuery } = createGqlkitApis<Context>();
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
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineQuery } = createGqlkitApis<Context>();
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
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          type CreateUserInput = { name: string };
          const { defineMutation } = createGqlkitApis<Context>();
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
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; firstName: string; lastName: string };
          const { defineField } = createGqlkitApis<Context>();
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
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string };
          type Post = { id: string; title: string };
          type PostsArgs = { limit: number };
          const { defineField } = createGqlkitApis<Context>();
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
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string };
          const { defineQuery } = createGqlkitApis<Context>();
          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1" })
          );
        `,
        "mutations.ts": `
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string };
          const { defineMutation } = createGqlkitApis<Context>();
          export const deleteUser = defineMutation<{ id: string }, User>(
            (root, args, ctx, info) => ({ id: args.id })
          );
        `,
        "user-fields.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineField } = createGqlkitApis<Context>();
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
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string };
          const { defineQuery } = createGqlkitApis<Context>();

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
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string };
          const { defineQuery } = createGqlkitApis<Context>();
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
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string };
          const { defineQuery } = createGqlkitApis<Context>();
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
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string };
          type GetUserArgs = { id: string };
          const { defineQuery } = createGqlkitApis<Context>();
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
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineMutation } = createGqlkitApis<Context>();
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
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string };
          const { defineQuery } = createGqlkitApis<Context>();
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

  describe("createGqlkitApis detection", () => {
    it("should detect query resolver from createGqlkitApis", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };

          const { defineQuery } = createGqlkitApis<Context>();

          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: ctx.userId, name: "Me" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      const resolver = result.resolvers[0]!;
      assert.equal(resolver.fieldName, "me");
      assert.equal(resolver.resolverType, "query");
    });

    it("should detect mutation resolver from createGqlkitApis", () => {
      const { program, filePaths } = createTestProgram({
        "mutations.ts": `
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };

          const { defineMutation } = createGqlkitApis<Context>();

          export const createUser = defineMutation<{ name: string }, User>(
            (root, args, ctx, info) => ({ id: "new", name: args.name })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      const resolver = result.resolvers[0]!;
      assert.equal(resolver.fieldName, "createUser");
      assert.equal(resolver.resolverType, "mutation");
    });

    it("should detect field resolver from createGqlkitApis", () => {
      const { program, filePaths } = createTestProgram({
        "fields.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; firstName: string; lastName: string };

          const { defineField } = createGqlkitApis<Context>();

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

    it("should detect resolvers from multiple createGqlkitApis calls", () => {
      const { program, filePaths } = createTestProgram({
        "admin-queries.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type AdminContext = { adminId: string };
          type User = { id: string; name: string };

          const { defineQuery } = createGqlkitApis<AdminContext>();

          export const adminUsers = defineQuery<NoArgs, User[]>(
            (root, args, ctx, info) => []
          );
        `,
        "public-queries.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type PublicContext = { sessionId: string };
          type User = { id: string; name: string };

          const { defineQuery } = createGqlkitApis<PublicContext>();

          export const publicUser = defineQuery<{ id: string }, User>(
            (root, args, ctx, info) => ({ id: args.id, name: "Public" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 2);
      const fieldNames = result.resolvers.map((r) => r.fieldName);
      assert.ok(fieldNames.includes("adminUsers"));
      assert.ok(fieldNames.includes("publicUser"));
    });

    it("should not detect non-resolver exports", () => {
      const { program, filePaths } = createTestProgram({
        "mixed.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };

          const { defineQuery } = createGqlkitApis<Context>();

          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1", name: "Me" })
          );

          // These should not be detected
          export const someValue = { foo: "bar" };
          export const someFunction = () => 42;
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      assert.equal(result.resolvers[0]!.fieldName, "me");
    });

    it("should support renamed destructured bindings", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };

          const { defineQuery: myDefineQuery } = createGqlkitApis<Context>();

          export const me = myDefineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1", name: "Me" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      assert.equal(result.resolvers[0]!.fieldName, "me");
      assert.equal(result.resolvers[0]!.resolverType, "query");
    });
  });

  describe("branded type detection", () => {
    it("should detect QueryResolver branded type", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineQuery } = createGqlkitApis<Context>();
          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1", name: "Me" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      assert.equal(result.resolvers[0]!.resolverType, "query");
    });

    it("should detect MutationResolver branded type", () => {
      const { program, filePaths } = createTestProgram({
        "mutations.ts": `
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineMutation } = createGqlkitApis<Context>();
          export const createUser = defineMutation<{ name: string }, User>(
            (root, args, ctx, info) => ({ id: "new", name: args.name })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      assert.equal(result.resolvers[0]!.resolverType, "mutation");
    });

    it("should detect FieldResolver branded type", () => {
      const { program, filePaths } = createTestProgram({
        "fields.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; firstName: string; lastName: string };
          const { defineField } = createGqlkitApis<Context>();
          export const fullName = defineField<User, NoArgs, string>(
            (parent, args, ctx, info) => parent.firstName + " " + parent.lastName
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 1);
      assert.equal(result.resolvers[0]!.resolverType, "field");
    });

    it("should return undefined for non-resolver functions", () => {
      const { program, filePaths } = createTestProgram({
        "utils.ts": `
          export const helper = () => 42;
          export const otherFunc = (x: number) => x * 2;
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      assert.equal(result.resolvers.length, 0);
    });
  });

  describe("re-export pattern detection", () => {
    it("should detect resolver from single re-export (gqlkit.ts pattern)", () => {
      const { program, filePaths } = createTestProgram({
        "gqlkit.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          export type Context = { userId: string };
          export const { defineQuery, defineMutation, defineField } = createGqlkitApis<Context>();
          export type { NoArgs };
        `,
        "resolvers/queries.ts": `
          import { defineQuery, type NoArgs } from "../gqlkit.js";
          type User = { id: string; name: string };
          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1", name: "Me" })
          );
        `,
      });

      const queriesFile = filePaths.find((f) => f.includes("queries.ts"))!;
      const result = extractDefineApiResolvers(program, [queriesFile]);

      assert.equal(result.resolvers.length, 1);
      assert.equal(result.resolvers[0]!.fieldName, "me");
      assert.equal(result.resolvers[0]!.resolverType, "query");
    });

    it("should detect mutation resolver from re-export", () => {
      const { program, filePaths } = createTestProgram({
        "gqlkit.ts": `
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          export type Context = { userId: string };
          export const { defineQuery, defineMutation, defineField } = createGqlkitApis<Context>();
        `,
        "resolvers/mutations.ts": `
          import { defineMutation } from "../gqlkit.js";
          type User = { id: string; name: string };
          export const createUser = defineMutation<{ name: string }, User>(
            (root, args, ctx, info) => ({ id: "new", name: args.name })
          );
        `,
      });

      const mutationsFile = filePaths.find((f) => f.includes("mutations.ts"))!;
      const result = extractDefineApiResolvers(program, [mutationsFile]);

      assert.equal(result.resolvers.length, 1);
      assert.equal(result.resolvers[0]!.fieldName, "createUser");
      assert.equal(result.resolvers[0]!.resolverType, "mutation");
    });

    it("should detect field resolver from re-export", () => {
      const { program, filePaths } = createTestProgram({
        "gqlkit.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          export type Context = { userId: string };
          export const { defineQuery, defineMutation, defineField } = createGqlkitApis<Context>();
          export type { NoArgs };
        `,
        "resolvers/user-fields.ts": `
          import { defineField, type NoArgs } from "../gqlkit.js";
          type User = { id: string; firstName: string; lastName: string };
          export const fullName = defineField<User, NoArgs, string>(
            (parent, args, ctx, info) => parent.firstName + " " + parent.lastName
          );
        `,
      });

      const userFieldsFile = filePaths.find((f) =>
        f.includes("user-fields.ts"),
      )!;
      const result = extractDefineApiResolvers(program, [userFieldsFile]);

      assert.equal(result.resolvers.length, 1);
      assert.equal(result.resolvers[0]!.fieldName, "fullName");
      assert.equal(result.resolvers[0]!.resolverType, "field");
      assert.equal(result.resolvers[0]!.parentTypeName, "User");
    });

    it("should detect resolver with renamed re-export", () => {
      const { program, filePaths } = createTestProgram({
        "gqlkit.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          export type Context = { userId: string };
          const apis = createGqlkitApis<Context>();
          export const myDefineQuery = apis.defineQuery;
          export type { NoArgs };
        `,
        "resolvers/queries.ts": `
          import { myDefineQuery, type NoArgs } from "../gqlkit.js";
          type User = { id: string; name: string };
          export const me = myDefineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1", name: "Me" })
          );
        `,
      });

      const queriesFile = filePaths.find((f) => f.includes("queries.ts"))!;
      const result = extractDefineApiResolvers(program, [queriesFile]);

      assert.equal(result.resolvers.length, 1);
      assert.equal(result.resolvers[0]!.fieldName, "me");
      assert.equal(result.resolvers[0]!.resolverType, "query");
    });

    it("should detect multiple resolvers from different re-export files", () => {
      const { program, filePaths } = createTestProgram({
        "gqlkit.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          export type Context = { userId: string };
          export const { defineQuery, defineMutation, defineField } = createGqlkitApis<Context>();
          export type { NoArgs };
        `,
        "resolvers/queries.ts": `
          import { defineQuery, type NoArgs } from "../gqlkit.js";
          type User = { id: string; name: string };
          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1", name: "Me" })
          );
        `,
        "resolvers/mutations.ts": `
          import { defineMutation } from "../gqlkit.js";
          type User = { id: string; name: string };
          export const createUser = defineMutation<{ name: string }, User>(
            (root, args, ctx, info) => ({ id: "new", name: args.name })
          );
        `,
      });

      const queriesFile = filePaths.find((f) => f.includes("queries.ts"))!;
      const mutationsFile = filePaths.find((f) => f.includes("mutations.ts"))!;
      const result = extractDefineApiResolvers(program, [
        queriesFile,
        mutationsFile,
      ]);

      assert.equal(result.resolvers.length, 2);
      const fieldNames = result.resolvers.map((r) => r.fieldName);
      assert.ok(fieldNames.includes("me"));
      assert.ok(fieldNames.includes("createUser"));
    });
  });
});
