import ts from "typescript";
import { describe, expect, it } from "vitest";
import { extractDefineApiResolvers } from "./define-api-extractor.js";

function createProgram(code: string): ts.Program {
  const fileName = "/test/src/gqlkit/schema/types.ts";
  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    noEmit: true,
  };

  const host: ts.CompilerHost = {
    getSourceFile: (name) => {
      if (name === fileName) return sourceFile;
      return undefined;
    },
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: () => {},
    getCurrentDirectory: () => "/test",
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (name) => name === fileName,
    readFile: () => undefined,
  };

  return ts.createProgram([fileName], compilerOptions, host);
}

describe("extractDefineApiResolvers - abstractTypeResolvers", () => {
  describe("resolveType detection", () => {
    it("should detect resolveType resolver with targetTypeName from type parameter", () => {
      const code = `
import type { GraphQLResolveInfo } from "graphql";

type Animal = Dog | Cat;
type Dog = { kind: "dog"; name: string };
type Cat = { kind: "cat"; lives: number };

type ResolveTypeResolverFn<TAbstract, TContext = unknown> = (
  value: TAbstract,
  context: TContext,
  info: GraphQLResolveInfo,
) => string | Promise<string>;

type ResolveTypeResolver<TAbstract, TContext = unknown> =
  ResolveTypeResolverFn<TAbstract, TContext> & {
    " $gqlkitAbstractResolver"?: {
      kind: "resolveType";
      targetType: TAbstract;
    };
  };

function defineResolveType<TAbstract>(
  resolver: ResolveTypeResolverFn<TAbstract, unknown>,
): ResolveTypeResolver<TAbstract, unknown> {
  return resolver as ResolveTypeResolver<TAbstract, unknown>;
}

export const animalResolveType = defineResolveType<Animal>((value) => {
  return value.kind === "dog" ? "Dog" : "Cat";
});
`;

      const program = createProgram(code);
      const result = extractDefineApiResolvers(program, [
        "/test/src/gqlkit/schema/types.ts",
      ]);

      expect(result.diagnostics).toEqual([]);
      expect(result.abstractTypeResolvers).toHaveLength(1);
      expect(result.abstractTypeResolvers[0]).toMatchObject({
        kind: "resolveType",
        targetTypeName: "Animal",
        exportName: "animalResolveType",
        sourceFile: "/test/src/gqlkit/schema/types.ts",
      });
      expect(result.abstractTypeResolvers[0]?.sourceLocation).toBeDefined();
      expect(
        result.abstractTypeResolvers[0]?.sourceLocation.line,
      ).toBeGreaterThan(0);
    });
  });

  describe("isTypeOf detection", () => {
    it("should detect isTypeOf resolver with targetTypeName from type parameter", () => {
      const code = `
import type { GraphQLResolveInfo } from "graphql";

type Dog = { kind: "dog"; name: string };

type IsTypeOfResolverFn<TObject, TContext = unknown> = (
  value: unknown,
  context: TContext,
  info: GraphQLResolveInfo,
) => boolean | Promise<boolean>;

type IsTypeOfResolver<TObject, TContext = unknown> =
  IsTypeOfResolverFn<TObject, TContext> & {
    " $gqlkitAbstractResolver"?: {
      kind: "isTypeOf";
      targetType: TObject;
    };
  };

function defineIsTypeOf<TObject>(
  resolver: IsTypeOfResolverFn<TObject, unknown>,
): IsTypeOfResolver<TObject, unknown> {
  return resolver as IsTypeOfResolver<TObject, unknown>;
}

export const dogIsTypeOf = defineIsTypeOf<Dog>((value) => {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "dog";
});
`;

      const program = createProgram(code);
      const result = extractDefineApiResolvers(program, [
        "/test/src/gqlkit/schema/types.ts",
      ]);

      expect(result.diagnostics).toEqual([]);
      expect(result.abstractTypeResolvers).toHaveLength(1);
      expect(result.abstractTypeResolvers[0]).toMatchObject({
        kind: "isTypeOf",
        targetTypeName: "Dog",
        exportName: "dogIsTypeOf",
        sourceFile: "/test/src/gqlkit/schema/types.ts",
      });
      expect(result.abstractTypeResolvers[0]?.sourceLocation).toBeDefined();
      expect(
        result.abstractTypeResolvers[0]?.sourceLocation.line,
      ).toBeGreaterThan(0);
    });
  });

  describe("naming convention independence", () => {
    it("should not infer type from export name, only from metadata", () => {
      const code = `
import type { GraphQLResolveInfo } from "graphql";

type Animal = { name: string };

type ResolveTypeResolverFn<TAbstract, TContext = unknown> = (
  value: TAbstract,
  context: TContext,
  info: GraphQLResolveInfo,
) => string | Promise<string>;

type ResolveTypeResolver<TAbstract, TContext = unknown> =
  ResolveTypeResolverFn<TAbstract, TContext> & {
    " $gqlkitAbstractResolver"?: {
      kind: "resolveType";
      targetType: TAbstract;
    };
  };

function defineResolveType<TAbstract>(
  resolver: ResolveTypeResolverFn<TAbstract, unknown>,
): ResolveTypeResolver<TAbstract, unknown> {
  return resolver as ResolveTypeResolver<TAbstract, unknown>;
}

// Export name does not match type name - should still work
export const someArbitraryName = defineResolveType<Animal>((value) => "Animal");
`;

      const program = createProgram(code);
      const result = extractDefineApiResolvers(program, [
        "/test/src/gqlkit/schema/types.ts",
      ]);

      expect(result.diagnostics).toEqual([]);
      expect(result.abstractTypeResolvers).toHaveLength(1);
      expect(result.abstractTypeResolvers[0]).toMatchObject({
        kind: "resolveType",
        targetTypeName: "Animal",
        exportName: "someArbitraryName",
      });
    });
  });

  describe("unresolved type handling", () => {
    it("should skip abstract resolvers when type cannot be resolved", () => {
      const code = `
import type { GraphQLResolveInfo } from "graphql";

type BaseAnimal = { kind: string };
type Animal = Pick<BaseAnimal, "kind"> & { name: string };

type ResolveTypeResolverFn<TAbstract, TContext = unknown> = (
  value: TAbstract,
  context: TContext,
  info: GraphQLResolveInfo,
) => string | Promise<string>;

type ResolveTypeResolver<TAbstract, TContext = unknown> =
  ResolveTypeResolverFn<TAbstract, TContext> & {
    " $gqlkitAbstractResolver"?: {
      kind: "resolveType";
      targetType: TAbstract;
    };
  };

function defineResolveType<TAbstract>(
  resolver: ResolveTypeResolverFn<TAbstract, unknown>,
): ResolveTypeResolver<TAbstract, unknown> {
  return resolver as ResolveTypeResolver<TAbstract, unknown>;
}

export const animalResolveType = defineResolveType<Animal>((value) => "Animal");
`;

      const program = createProgram(code);
      const result = extractDefineApiResolvers(program, [
        "/test/src/gqlkit/schema/types.ts",
      ]);

      expect(result.diagnostics).toEqual([]);
    });
  });

  describe("source location recording", () => {
    it("should record accurate source location for error reporting", () => {
      const code = `import type { GraphQLResolveInfo } from "graphql";

type Animal = { name: string };

type ResolveTypeResolverFn<TAbstract, TContext = unknown> = (
  value: TAbstract,
  context: TContext,
  info: GraphQLResolveInfo,
) => string | Promise<string>;

type ResolveTypeResolver<TAbstract, TContext = unknown> =
  ResolveTypeResolverFn<TAbstract, TContext> & {
    " $gqlkitAbstractResolver"?: {
      kind: "resolveType";
      targetType: TAbstract;
    };
  };

function defineResolveType<TAbstract>(
  resolver: ResolveTypeResolverFn<TAbstract, unknown>,
): ResolveTypeResolver<TAbstract, unknown> {
  return resolver as ResolveTypeResolver<TAbstract, unknown>;
}

export const animalResolveType = defineResolveType<Animal>((value) => "Animal");
`;

      const program = createProgram(code);
      const result = extractDefineApiResolvers(program, [
        "/test/src/gqlkit/schema/types.ts",
      ]);

      expect(result.abstractTypeResolvers).toHaveLength(1);
      const resolver = result.abstractTypeResolvers[0]!;
      expect(resolver.sourceLocation.file).toBe(
        "/test/src/gqlkit/schema/types.ts",
      );
      expect(resolver.sourceLocation.line).toBe(25);
      expect(resolver.sourceLocation.column).toBeGreaterThan(0);
    });
  });

  describe("multiple abstract resolvers", () => {
    it("should detect multiple abstract resolvers in the same file", () => {
      const code = `
import type { GraphQLResolveInfo } from "graphql";

type Dog = { kind: "dog"; name: string };
type Cat = { kind: "cat"; lives: number };
type Animal = Dog | Cat;

type ResolveTypeResolverFn<TAbstract, TContext = unknown> = (
  value: TAbstract,
  context: TContext,
  info: GraphQLResolveInfo,
) => string | Promise<string>;

type IsTypeOfResolverFn<TObject, TContext = unknown> = (
  value: unknown,
  context: TContext,
  info: GraphQLResolveInfo,
) => boolean | Promise<boolean>;

type ResolveTypeResolver<TAbstract, TContext = unknown> =
  ResolveTypeResolverFn<TAbstract, TContext> & {
    " $gqlkitAbstractResolver"?: {
      kind: "resolveType";
      targetType: TAbstract;
    };
  };

type IsTypeOfResolver<TObject, TContext = unknown> =
  IsTypeOfResolverFn<TObject, TContext> & {
    " $gqlkitAbstractResolver"?: {
      kind: "isTypeOf";
      targetType: TObject;
    };
  };

function defineResolveType<TAbstract>(
  resolver: ResolveTypeResolverFn<TAbstract, unknown>,
): ResolveTypeResolver<TAbstract, unknown> {
  return resolver as ResolveTypeResolver<TAbstract, unknown>;
}

function defineIsTypeOf<TObject>(
  resolver: IsTypeOfResolverFn<TObject, unknown>,
): IsTypeOfResolver<TObject, unknown> {
  return resolver as IsTypeOfResolver<TObject, unknown>;
}

export const animalResolveType = defineResolveType<Animal>((value) => {
  return value.kind === "dog" ? "Dog" : "Cat";
});

export const dogIsTypeOf = defineIsTypeOf<Dog>((value) => {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "dog";
});

export const catIsTypeOf = defineIsTypeOf<Cat>((value) => {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "cat";
});
`;

      const program = createProgram(code);
      const result = extractDefineApiResolvers(program, [
        "/test/src/gqlkit/schema/types.ts",
      ]);

      expect(result.diagnostics).toEqual([]);
      expect(result.abstractTypeResolvers).toHaveLength(3);

      const resolveType = result.abstractTypeResolvers.find(
        (r) => r.kind === "resolveType",
      );
      expect(resolveType).toMatchObject({
        kind: "resolveType",
        targetTypeName: "Animal",
        exportName: "animalResolveType",
      });

      const isTypeOfs = result.abstractTypeResolvers.filter(
        (r) => r.kind === "isTypeOf",
      );
      expect(isTypeOfs).toHaveLength(2);
      expect(isTypeOfs.map((r) => r.targetTypeName).sort()).toEqual([
        "Cat",
        "Dog",
      ]);
    });
  });

  describe("non-exported abstract resolvers", () => {
    it("should not detect non-exported abstract resolvers", () => {
      const code = `
import type { GraphQLResolveInfo } from "graphql";

type Animal = { name: string };

type ResolveTypeResolverFn<TAbstract, TContext = unknown> = (
  value: TAbstract,
  context: TContext,
  info: GraphQLResolveInfo,
) => string | Promise<string>;

type ResolveTypeResolver<TAbstract, TContext = unknown> =
  ResolveTypeResolverFn<TAbstract, TContext> & {
    " $gqlkitAbstractResolver"?: {
      kind: "resolveType";
      targetType: TAbstract;
    };
  };

function defineResolveType<TAbstract>(
  resolver: ResolveTypeResolverFn<TAbstract, unknown>,
): ResolveTypeResolver<TAbstract, unknown> {
  return resolver as ResolveTypeResolver<TAbstract, unknown>;
}

// Not exported - should not be detected
const animalResolveType = defineResolveType<Animal>((value) => "Animal");
`;

      const program = createProgram(code);
      const result = extractDefineApiResolvers(program, [
        "/test/src/gqlkit/schema/types.ts",
      ]);

      expect(result.abstractTypeResolvers).toHaveLength(0);
    });
  });
});
