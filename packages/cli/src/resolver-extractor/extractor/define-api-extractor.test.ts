import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
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

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.fieldName).toBe("me");
      expect(resolver.resolverType).toBe("query");
      expect(resolver.parentTypeName).toBeNull();
      expect(result.diagnostics.length).toBe(0);
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

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.fieldName).toBe("user");
      expect(resolver.resolverType).toBe("query");
      expect(resolver.argsType).toBeTruthy();
      expect(resolver.argsType?.kind).toBe("reference");
      expect(resolver.argsType?.name).toBe("GetUserArgs");
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

      expect(result.resolvers.length).toBe(2);
      expect(result.resolvers[0]!.fieldName).toBe("me");
      expect(result.resolvers[1]!.fieldName).toBe("users");
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

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.fieldName).toBe("createUser");
      expect(resolver.resolverType).toBe("mutation");
      expect(resolver.parentTypeName).toBeNull();
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

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.fieldName).toBe("fullName");
      expect(resolver.resolverType).toBe("field");
      expect(resolver.parentTypeName).toBe("User");
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

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.fieldName).toBe("posts");
      expect(resolver.resolverType).toBe("field");
      expect(resolver.parentTypeName).toBe("User");
      expect(resolver.argsType).toBeTruthy();
      expect(resolver.argsType?.kind).toBe("reference");
      expect(resolver.argsType?.name).toBe("PostsArgs");
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

      expect(result.resolvers.length).toBe(3);
      const types = result.resolvers.map((r) => r.resolverType);
      expect(types.includes("query")).toBeTruthy();
      expect(types.includes("mutation")).toBeTruthy();
      expect(types.includes("field")).toBeTruthy();
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

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.fieldName).toBe("me");
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

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.returnType).toBeTruthy();
      expect(resolver.returnType?.kind).toBe("reference");
      expect(resolver.returnType?.name).toBe("User");
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

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.returnType).toBeTruthy();
      expect(resolver.returnType?.kind).toBe("array");
      expect(resolver.returnType?.elementType).toBeTruthy();
      expect(resolver.returnType?.elementType?.kind).toBe("reference");
      expect(resolver.returnType?.elementType?.name).toBe("User");
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

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.returnType).toBeTruthy();
      expect(resolver.returnType?.nullable).toBe(true);
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

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.exportedInputTypes).toBeTruthy();
      expect(resolver.exportedInputTypes?.length).toBe(1);
      expect(resolver.exportedInputTypes?.[0]?.name).toBe("CreateUserInput");
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

      expect(result.resolvers.length).toBe(0);
      expect(result.diagnostics.length > 0).toBeTruthy();
      const diagnostic = result.diagnostics[0]!;
      expect(diagnostic.code).toBe("INVALID_DEFINE_CALL");
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

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.fieldName).toBe("me");
      expect(resolver.resolverType).toBe("query");
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

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.fieldName).toBe("createUser");
      expect(resolver.resolverType).toBe("mutation");
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

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.fieldName).toBe("fullName");
      expect(resolver.resolverType).toBe("field");
      expect(resolver.parentTypeName).toBe("User");
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

      expect(result.resolvers.length).toBe(2);
      const fieldNames = result.resolvers.map((r) => r.fieldName);
      expect(fieldNames.includes("adminUsers")).toBeTruthy();
      expect(fieldNames.includes("publicUser")).toBeTruthy();
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

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.fieldName).toBe("me");
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

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.fieldName).toBe("me");
      expect(result.resolvers[0]!.resolverType).toBe("query");
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

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.resolverType).toBe("query");
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

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.resolverType).toBe("mutation");
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

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.resolverType).toBe("field");
    });

    it("should return undefined for non-resolver functions", () => {
      const { program, filePaths } = createTestProgram({
        "utils.ts": `
          export const helper = () => 42;
          export const otherFunc = (x: number) => x * 2;
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      expect(result.resolvers.length).toBe(0);
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

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.fieldName).toBe("me");
      expect(result.resolvers[0]!.resolverType).toBe("query");
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

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.fieldName).toBe("createUser");
      expect(result.resolvers[0]!.resolverType).toBe("mutation");
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

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.fieldName).toBe("fullName");
      expect(result.resolvers[0]!.resolverType).toBe("field");
      expect(result.resolvers[0]!.parentTypeName).toBe("User");
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

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.fieldName).toBe("me");
      expect(result.resolvers[0]!.resolverType).toBe("query");
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

      expect(result.resolvers.length).toBe(2);
      const fieldNames = result.resolvers.map((r) => r.fieldName);
      expect(fieldNames.includes("me")).toBeTruthy();
      expect(fieldNames.includes("createUser")).toBeTruthy();
    });
  });

  describe("description extraction", () => {
    it("should extract description from query resolver TSDoc", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineQuery } = createGqlkitApis<Context>();
          /** Get the currently authenticated user */
          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1", name: "Me" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.description).toBe(
        "Get the currently authenticated user",
      );
    });

    it("should extract description from mutation resolver TSDoc", () => {
      const { program, filePaths } = createTestProgram({
        "mutations.ts": `
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineMutation } = createGqlkitApis<Context>();
          /** Create a new user with the given name */
          export const createUser = defineMutation<{ name: string }, User>(
            (root, args, ctx, info) => ({ id: "new", name: args.name })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.description).toBe(
        "Create a new user with the given name",
      );
    });

    it("should extract description from field resolver TSDoc", () => {
      const { program, filePaths } = createTestProgram({
        "fields.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; firstName: string; lastName: string };
          const { defineField } = createGqlkitApis<Context>();
          /** The user's full name computed from first and last name */
          export const fullName = defineField<User, NoArgs, string>(
            (parent, args, ctx, info) => parent.firstName + " " + parent.lastName
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.description).toBe(
        "The user's full name computed from first and last name",
      );
    });

    it("should return undefined description when no TSDoc exists", () => {
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

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.description).toBeNull();
    });

    it("should extract deprecated from resolver TSDoc", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineQuery } = createGqlkitApis<Context>();
          /**
           * Get the currently authenticated user
           * @deprecated Use currentUser instead
           */
          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1", name: "Me" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.description).toBe(
        "Get the currently authenticated user",
      );
      expect(result.resolvers[0]!.deprecated).toBeTruthy();
      expect(result.resolvers[0]!.deprecated?.isDeprecated).toBe(true);
      expect(result.resolvers[0]!.deprecated?.reason).toBe(
        "Use currentUser instead",
      );
    });

    it("should extract deprecated without reason", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { createGqlkitApis, NoArgs } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineQuery } = createGqlkitApis<Context>();
          /**
           * Get the currently authenticated user
           * @deprecated
           */
          export const me = defineQuery<NoArgs, User>(
            (root, args, ctx, info) => ({ id: "1", name: "Me" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      expect(result.resolvers.length).toBe(1);
      expect(result.resolvers[0]!.deprecated).toBeTruthy();
      expect(result.resolvers[0]!.deprecated?.isDeprecated).toBe(true);
      expect(result.resolvers[0]!.deprecated?.reason).toBeNull();
    });
  });

  describe("argument description extraction", () => {
    it("should extract description from inline type literal argument", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<{
            /** The unique identifier of the user */
            id: string;
          }, User>(
            (root, args, ctx, info) => ({ id: args.id, name: "User" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.args).toBeTruthy();
      expect(resolver.args?.length).toBe(1);
      expect(resolver.args?.[0]?.name).toBe("id");
      expect(resolver.args?.[0]?.description).toBe(
        "The unique identifier of the user",
      );
    });

    it("should extract description from referenced type definition", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          type GetUserArgs = {
            /** The unique identifier of the user */
            id: string;
          };
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<GetUserArgs, User>(
            (root, args, ctx, info) => ({ id: args.id, name: "User" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.args).toBeTruthy();
      expect(resolver.args?.length).toBe(1);
      expect(resolver.args?.[0]?.name).toBe("id");
      expect(resolver.args?.[0]?.description).toBe(
        "The unique identifier of the user",
      );
    });

    it("should prioritize inline type literal over referenced type definition", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          type GetUserArgs = {
            /** Description from referenced type */
            id: string;
          };
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<{
            /** Description from inline type */
            id: string;
          } & GetUserArgs, User>(
            (root, args, ctx, info) => ({ id: args.id, name: "User" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.args).toBeTruthy();
      expect(resolver.args?.length).toBe(1);
      expect(resolver.args?.[0]?.name).toBe("id");
      expect(resolver.args?.[0]?.description).toBe(
        "Description from inline type",
      );
    });

    it("should return undefined description when argument has no TSDoc", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<{ id: string }, User>(
            (root, args, ctx, info) => ({ id: args.id, name: "User" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.args).toBeTruthy();
      expect(resolver.args?.length).toBe(1);
      expect(resolver.args?.[0]?.name).toBe("id");
      expect(resolver.args?.[0]?.description).toBeNull();
    });

    it("should extract deprecated from argument TSDoc", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineQuery } = createGqlkitApis<Context>();
          export const user = defineQuery<{
            /**
             * The unique identifier
             * @deprecated Use uuid instead
             */
            id: string;
          }, User>(
            (root, args, ctx, info) => ({ id: args.id, name: "User" })
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.args).toBeTruthy();
      expect(resolver.args?.length).toBe(1);
      expect(resolver.args?.[0]?.name).toBe("id");
      expect(resolver.args?.[0]?.description).toBe("The unique identifier");
      expect(resolver.args?.[0]?.deprecated).toBeTruthy();
      expect(resolver.args?.[0]?.deprecated?.isDeprecated).toBe(true);
      expect(resolver.args?.[0]?.deprecated?.reason).toBe("Use uuid instead");
    });

    it("should extract description from multiple arguments", () => {
      const { program, filePaths } = createTestProgram({
        "queries.ts": `
          import { createGqlkitApis } from "@gqlkit-ts/runtime";
          type Context = { userId: string };
          type User = { id: string; name: string };
          const { defineQuery } = createGqlkitApis<Context>();
          export const searchUsers = defineQuery<{
            /** Search query string */
            query: string;
            /** Maximum number of results */
            limit?: number;
          }, User[]>(
            (root, args, ctx, info) => []
          );
        `,
      });

      const result = extractDefineApiResolvers(program, filePaths);

      expect(result.resolvers.length).toBe(1);
      const resolver = result.resolvers[0]!;
      expect(resolver.args).toBeTruthy();
      expect(resolver.args?.length).toBe(2);

      const queryArg = resolver.args?.find((a) => a.name === "query");
      expect(queryArg).toBeTruthy();
      expect(queryArg?.description).toBe("Search query string");

      const limitArg = resolver.args?.find((a) => a.name === "limit");
      expect(limitArg).toBeTruthy();
      expect(limitArg?.description).toBe("Maximum number of results");
    });
  });
});
