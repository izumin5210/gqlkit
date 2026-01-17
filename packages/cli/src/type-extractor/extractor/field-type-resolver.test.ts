import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveFieldType } from "./field-type-resolver.js";

describe("resolveFieldType", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "field-type-resolver-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function createProgram(files: Record<string, string>): ts.Program {
    const filePaths: string[] = [];
    for (const name of Object.keys(files)) {
      const filePath = join(tempDir, name);
      filePaths.push(filePath);
    }

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.Node16,
      strict: true,
      noEmit: true,
    };

    const host = ts.createCompilerHost(compilerOptions);
    const originalReadFile = host.readFile.bind(host);
    host.readFile = (fileName: string) => {
      for (const [name, content] of Object.entries(files)) {
        if (fileName === join(tempDir, name)) {
          return content;
        }
      }
      return originalReadFile(fileName);
    };
    host.fileExists = (fileName: string) => {
      for (const name of Object.keys(files)) {
        if (fileName === join(tempDir, name)) {
          return true;
        }
      }
      return ts.sys.fileExists(fileName);
    };

    return ts.createProgram(filePaths, compilerOptions, host);
  }

  function getPropertyType(
    program: ts.Program,
    typeName: string,
    propertyName: string,
  ): { type: ts.Type; typeNode: ts.TypeNode | undefined } {
    const checker = program.getTypeChecker();
    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;
      for (const statement of sourceFile.statements) {
        if (
          (ts.isTypeAliasDeclaration(statement) ||
            ts.isInterfaceDeclaration(statement)) &&
          statement.name.text === typeName
        ) {
          const type = checker.getTypeAtLocation(statement);
          const prop = type.getProperty(propertyName);
          if (prop) {
            const propType = checker.getTypeOfSymbol(prop);
            const decl = prop.valueDeclaration;
            const typeNode =
              decl &&
              (ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl))
                ? decl.type
                : undefined;
            return { type: propType, typeNode };
          }
        }
      }
    }
    throw new Error(`Property ${propertyName} not found in type ${typeName}`);
  }

  describe("reference vs inlineObject decision", () => {
    it("should return reference when type is in knownTypeNames", () => {
      const program = createProgram({
        "types.ts": `
          export type User = { id: string; name: string };
          export type Post = { author: User };
        `,
      });
      const checker = program.getTypeChecker();
      const { type, typeNode } = getPropertyType(program, "Post", "author");
      const knownTypeNames = new Set(["User", "Post"]);

      const result = resolveFieldType(type, typeNode, {
        checker,
        knownTypeNames,
        globalTypeMappings: [],
      });

      expect(result.kind).toBe("reference");
      expect(result.name).toBe("User");
    });

    it("should return inlineObject when type is NOT in knownTypeNames (user-defined utility)", () => {
      const program = createProgram({
        "types.ts": `
          type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };
          export type User = { id: string; name: string };
          export type Post = { author: DeepPartial<User> };
        `,
      });
      const checker = program.getTypeChecker();
      const { type, typeNode } = getPropertyType(program, "Post", "author");
      // DeepPartial is NOT in knownTypeNames
      const knownTypeNames = new Set(["User", "Post"]);

      const result = resolveFieldType(type, typeNode, {
        checker,
        knownTypeNames,
        globalTypeMappings: [],
      });

      expect(result.kind).toBe("inlineObject");
      expect(result.inlineObjectProperties).toBeDefined();
    });

    it("should return inlineObject for builtin utility types (Omit)", () => {
      const program = createProgram({
        "types.ts": `
          export type User = { id: string; name: string; password: string };
          export type Post = { author: Omit<User, 'password'> };
        `,
      });
      const checker = program.getTypeChecker();
      const { type, typeNode } = getPropertyType(program, "Post", "author");
      // Omit is NOT in knownTypeNames
      const knownTypeNames = new Set(["User", "Post"]);

      const result = resolveFieldType(type, typeNode, {
        checker,
        knownTypeNames,
        globalTypeMappings: [],
      });

      expect(result.kind).toBe("inlineObject");
      expect(result.inlineObjectProperties).toBeDefined();
    });
  });

  describe("intersection types in field context", () => {
    it("should return inlineObject for intersection type in field", () => {
      const program = createProgram({
        "types.ts": `
          export type A = { a: string };
          export type B = { b: number };
          export type Post = { merged: A & B };
        `,
      });
      const checker = program.getTypeChecker();
      const { type, typeNode } = getPropertyType(program, "Post", "merged");
      const knownTypeNames = new Set(["A", "B", "Post"]);

      const result = resolveFieldType(type, typeNode, {
        checker,
        knownTypeNames,
        globalTypeMappings: [],
      });

      expect(result.kind).toBe("inlineObject");
      expect(result.inlineObjectProperties).toBeDefined();
      expect(result.inlineObjectProperties?.length).toBe(2);
    });
  });

  describe("primitive types", () => {
    it("should return primitive for string field", () => {
      const program = createProgram({
        "types.ts": `
          export type User = { name: string };
        `,
      });
      const checker = program.getTypeChecker();
      const { type, typeNode } = getPropertyType(program, "User", "name");
      const knownTypeNames = new Set(["User"]);

      const result = resolveFieldType(type, typeNode, {
        checker,
        knownTypeNames,
        globalTypeMappings: [],
      });

      expect(result.kind).toBe("primitive");
      expect(result.name).toBe("string");
    });

    it("should return primitive for number field", () => {
      const program = createProgram({
        "types.ts": `
          export type User = { age: number };
        `,
      });
      const checker = program.getTypeChecker();
      const { type, typeNode } = getPropertyType(program, "User", "age");
      const knownTypeNames = new Set(["User"]);

      const result = resolveFieldType(type, typeNode, {
        checker,
        knownTypeNames,
        globalTypeMappings: [],
      });

      expect(result.kind).toBe("primitive");
      expect(result.name).toBe("number");
    });
  });

  describe("nullable types", () => {
    it("should preserve nullability", () => {
      const program = createProgram({
        "types.ts": `
          export type User = { id: string };
          export type Post = { author: User | null };
        `,
      });
      const checker = program.getTypeChecker();
      const { type, typeNode } = getPropertyType(program, "Post", "author");
      const knownTypeNames = new Set(["User", "Post"]);

      const result = resolveFieldType(type, typeNode, {
        checker,
        knownTypeNames,
        globalTypeMappings: [],
      });

      expect(result.kind).toBe("reference");
      expect(result.name).toBe("User");
      expect(result.nullable).toBe(true);
    });
  });

  describe("array types", () => {
    it("should handle array of known types", () => {
      const program = createProgram({
        "types.ts": `
          export type User = { id: string };
          export type Post = { authors: User[] };
        `,
      });
      const checker = program.getTypeChecker();
      const { type, typeNode } = getPropertyType(program, "Post", "authors");
      const knownTypeNames = new Set(["User", "Post"]);

      const result = resolveFieldType(type, typeNode, {
        checker,
        knownTypeNames,
        globalTypeMappings: [],
      });

      expect(result.kind).toBe("array");
      expect(result.elementType?.kind).toBe("reference");
      expect(result.elementType?.name).toBe("User");
    });
  });
});
