/**
 * Tests for ignoreFields metadata detection.
 */

import ts from "typescript";
import { describe, expect, it } from "vitest";
import { detectIgnoreFieldsMetadata } from "./ignore-fields-detector.js";

function createTestProgram(source: string): {
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
} {
  const fileName = "test.ts";
  const compilerHost = ts.createCompilerHost({});
  const originalGetSourceFile = compilerHost.getSourceFile;
  compilerHost.getSourceFile = (
    name,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    if (name === fileName) {
      return ts.createSourceFile(name, source, languageVersion, true);
    }
    return originalGetSourceFile(
      name,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
  };
  compilerHost.fileExists = (name) =>
    name === fileName || ts.sys.fileExists(name);
  compilerHost.readFile = (name) =>
    name === fileName ? source : ts.sys.readFile(name);

  const program = ts.createProgram(
    [fileName],
    {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
    compilerHost,
  );

  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) {
    throw new Error("Failed to get source file");
  }

  return {
    program,
    checker: program.getTypeChecker(),
    sourceFile,
  };
}

function getTypeFromDeclaration(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  typeName: string,
): ts.Type {
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement)) {
      const name = statement.name.getText(sourceFile);
      if (name === typeName) {
        const symbol = checker.getSymbolAtLocation(statement.name);
        if (symbol) {
          return checker.getDeclaredTypeOfSymbol(symbol);
        }
      }
    }
  }
  throw new Error(`Type ${typeName} not found`);
}

describe("detectIgnoreFieldsMetadata", () => {
  describe("when ignoreFields is not specified", () => {
    it("returns null for plain object type", () => {
      const source = `
        type User = {
          id: string;
          name: string;
        };
      `;
      const { checker, sourceFile } = createTestProgram(source);
      const type = getTypeFromDeclaration(sourceFile, checker, "User");

      const result = detectIgnoreFieldsMetadata({ type, checker });

      expect(result).toBeNull();
    });

    it("returns null for GqlObject without ignoreFields", () => {
      const source = `
        type GqlTypeMetaShape<Meta extends { ignoreFields?: string }> = {
          readonly ignoreFields?: Meta["ignoreFields"];
        };

        type GqlObject<T, Meta extends { ignoreFields?: keyof T & string } = object> = T & {
          readonly " $gqlkitTypeMeta"?: GqlTypeMetaShape<Meta>;
        };

        type User = GqlObject<{
          id: string;
          name: string;
        }>;
      `;
      const { checker, sourceFile } = createTestProgram(source);
      const type = getTypeFromDeclaration(sourceFile, checker, "User");

      const result = detectIgnoreFieldsMetadata({ type, checker });

      expect(result).toBeNull();
    });
  });

  describe("when ignoreFields is specified with a single field", () => {
    it("returns a Set containing the single field name", () => {
      const source = `
        type GqlTypeMetaShape<Meta extends { ignoreFields?: string }> = {
          readonly ignoreFields?: Meta["ignoreFields"];
        };

        type GqlObject<T, Meta extends { ignoreFields?: keyof T & string } = object> = T & {
          readonly " $gqlkitTypeMeta"?: GqlTypeMetaShape<Meta>;
        };

        type User = GqlObject<{
          id: string;
          name: string;
          internalId: string;
        }, { ignoreFields: "internalId" }>;
      `;
      const { checker, sourceFile } = createTestProgram(source);
      const type = getTypeFromDeclaration(sourceFile, checker, "User");

      const result = detectIgnoreFieldsMetadata({ type, checker });

      expect(result).not.toBeNull();
      expect(result).toEqual(new Set(["internalId"]));
    });
  });

  describe("when ignoreFields is specified with multiple fields (union)", () => {
    it("returns a Set containing all field names from the union", () => {
      const source = `
        type GqlTypeMetaShape<Meta extends { ignoreFields?: string }> = {
          readonly ignoreFields?: Meta["ignoreFields"];
        };

        type GqlObject<T, Meta extends { ignoreFields?: keyof T & string } = object> = T & {
          readonly " $gqlkitTypeMeta"?: GqlTypeMetaShape<Meta>;
        };

        type User = GqlObject<{
          id: string;
          name: string;
          internalId: string;
          cacheKey: string;
        }, { ignoreFields: "internalId" | "cacheKey" }>;
      `;
      const { checker, sourceFile } = createTestProgram(source);
      const type = getTypeFromDeclaration(sourceFile, checker, "User");

      const result = detectIgnoreFieldsMetadata({ type, checker });

      expect(result).not.toBeNull();
      expect(result).toEqual(new Set(["internalId", "cacheKey"]));
    });
  });

  describe("when ignoreFields is combined with other metadata", () => {
    it("extracts ignoreFields when used with directives", () => {
      const source = `
        type GqlDirective<Name extends string, Args = object> = {
          readonly " $directiveName": Name;
          readonly " $directiveArgs": Args;
        };

        type CacheDirective = GqlDirective<"cache", { maxAge: number }>;

        type GqlTypeMetaShape<Meta extends {
          directives?: readonly unknown[];
          ignoreFields?: string;
        }> = {
          readonly directives?: Meta["directives"];
          readonly ignoreFields?: Meta["ignoreFields"];
        };

        type GqlObject<T, Meta extends {
          directives?: readonly unknown[];
          ignoreFields?: keyof T & string;
        } = object> = T & {
          readonly " $gqlkitTypeMeta"?: GqlTypeMetaShape<Meta>;
        };

        type User = GqlObject<{
          id: string;
          name: string;
          internalId: string;
        }, {
          ignoreFields: "internalId";
          directives: [CacheDirective];
        }>;
      `;
      const { checker, sourceFile } = createTestProgram(source);
      const type = getTypeFromDeclaration(sourceFile, checker, "User");

      const result = detectIgnoreFieldsMetadata({ type, checker });

      expect(result).not.toBeNull();
      expect(result).toEqual(new Set(["internalId"]));
    });
  });
});
