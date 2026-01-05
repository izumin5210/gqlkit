/**
 * Tests for scalar metadata detector.
 *
 * This module tests the detection of scalar metadata from TypeScript types
 * using the new intersection type pattern with " $gqlkitScalar" property.
 */

import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  detectScalarMetadata,
  validateNoMixedScalarUnion,
} from "./scalar-metadata-detector.js";

function createTestProgram(code: string): {
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
} {
  const fileName = "/test.ts";
  const runtimeFileName = "/node_modules/@gqlkit-ts/runtime/index.d.ts";
  const libFileName = "/lib.d.ts";
  const runtimeStub = `
    export type DefineScalar<Name extends string, Base, Only extends "input" | "output" | undefined = undefined> = Base & {
      " $gqlkitScalar"?: { name: Name; only: Only };
    };
    export type Int = number & { " $gqlkitScalar"?: { name: "Int"; only: undefined } };
    export type Float = number & { " $gqlkitScalar"?: { name: "Float"; only: undefined } };
    export type IDString = string & { " $gqlkitScalar"?: { name: "ID"; only: undefined } };
    export type IDNumber = number & { " $gqlkitScalar"?: { name: "ID"; only: undefined } };
  `;
  const libStub = `
    interface Date {
      getTime(): number;
    }
    interface Array<T> {
      length: number;
      [n: number]: T;
    }
  `;

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
    baseUrl: "/",
    paths: {
      "@gqlkit-ts/runtime": ["/node_modules/@gqlkit-ts/runtime/index.d.ts"],
    },
  };

  const fileMap = new Map<string, string>([
    [fileName, code],
    [runtimeFileName, runtimeStub],
    [libFileName, libStub],
  ]);

  const host = ts.createCompilerHost(compilerOptions);

  host.getSourceFile = (requestedFileName, languageVersion) => {
    const content = fileMap.get(requestedFileName);
    if (content !== undefined) {
      return ts.createSourceFile(
        requestedFileName,
        content,
        languageVersion,
        true,
      );
    }
    return undefined;
  };

  host.fileExists = (requestedFileName) => {
    return fileMap.has(requestedFileName);
  };

  host.readFile = (requestedFileName) => {
    return fileMap.get(requestedFileName);
  };

  host.resolveModuleNames = (moduleNames, _containingFile) => {
    return moduleNames.map((moduleName) => {
      if (moduleName === "@gqlkit-ts/runtime") {
        return {
          resolvedFileName: runtimeFileName,
          isExternalLibraryImport: true,
        };
      }
      return undefined;
    });
  };

  host.getDirectories = () => [];
  host.directoryExists = () => true;

  const program = ts.createProgram(
    [fileName, runtimeFileName, libFileName],
    compilerOptions,
    host,
  );
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(fileName)!;

  return { program, checker, sourceFile };
}

function getTypeFromDeclaration(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  typeName: string,
): ts.Type {
  let foundType: ts.Type | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === typeName) {
      const symbol = checker.getSymbolAtLocation(node.name);
      if (symbol) {
        foundType = checker.getDeclaredTypeOfSymbol(symbol);
      }
    }
    if (ts.isInterfaceDeclaration(node) && node.name.text === typeName) {
      const symbol = checker.getSymbolAtLocation(node.name);
      if (symbol) {
        foundType = checker.getDeclaredTypeOfSymbol(symbol);
      }
    }
  });

  if (!foundType) {
    throw new Error(`Type '${typeName}' not found in source file`);
  }

  return foundType;
}

function getPropertyType(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  typeName: string,
  propertyName: string,
): ts.Type {
  const type = getTypeFromDeclaration(sourceFile, checker, typeName);
  const property = type.getProperty(propertyName);
  if (!property) {
    throw new Error(
      `Property '${propertyName}' not found in type '${typeName}'`,
    );
  }
  return checker.getTypeOfSymbol(property);
}

describe("detectScalarMetadata", () => {
  describe("Task 2.1: TypeScript primitive type auto-mapping", () => {
    it("should map string to GraphQL String", () => {
      const code = `
        type Test = { value: string };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo).toEqual({
        scalarName: "String",
        typeName: null,
        only: null,
        sourceFile: null,
        line: null,
        description: null,
      });
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should map boolean to GraphQL Boolean", () => {
      const code = `
        type Test = { value: boolean };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo).toEqual({
        scalarName: "Boolean",
        typeName: null,
        only: null,
        sourceFile: null,
        line: null,
        description: null,
      });
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should map number to GraphQL Float", () => {
      const code = `
        type Test = { value: number };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo).toEqual({
        scalarName: "Float",
        typeName: null,
        only: null,
        sourceFile: null,
        line: null,
        description: null,
      });
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe("Task 2.2: Intersection type scalar metadata detection", () => {
    it("should detect scalar metadata from intersection type with $gqlkitScalar property", () => {
      const code = `
        type DateTime = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: undefined } };
        type Test = { value: DateTime };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("DateTime");
      expect(result.scalarInfo?.only).toBeNull();
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should extract name property from scalar metadata", () => {
      const code = `
        type CustomScalar = string & { " $gqlkitScalar"?: { name: "CustomName"; only: undefined } };
        type Test = { value: CustomScalar };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("CustomName");
    });

    it("should extract only: 'input' from scalar metadata", () => {
      const code = `
        type DateTimeInput = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: "input" } };
        type Test = { value: DateTimeInput };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("DateTime");
      expect(result.scalarInfo?.only).toBe("input");
    });

    it("should extract only: 'output' from scalar metadata", () => {
      const code = `
        type DateTimeOutput = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: "output" } };
        type Test = { value: DateTimeOutput };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("DateTime");
      expect(result.scalarInfo?.only).toBe("output");
    });

    it("should handle missing only property as null (input/output both)", () => {
      const code = `
        type DateTime = Date & { " $gqlkitScalar"?: { name: "DateTime" } };
        type Test = { value: DateTime };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("DateTime");
      expect(result.scalarInfo?.only).toBeNull();
    });

    it("should detect Int from runtime", () => {
      const code = `
        import { Int } from "@gqlkit-ts/runtime";
        type Test = { value: Int };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("Int");
    });

    it("should detect IDString from runtime", () => {
      const code = `
        import { IDString } from "@gqlkit-ts/runtime";
        type Test = { value: IDString };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("ID");
    });
  });

  describe("Task 2.3: Type alias chain tracking", () => {
    it("should detect scalar metadata through single type alias", () => {
      const code = `
        import { Int } from "@gqlkit-ts/runtime";
        type MyInt = Int;
        type Test = { value: MyInt };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("Int");
    });

    it("should detect scalar metadata through multiple type alias chains", () => {
      const code = `
        import { Int } from "@gqlkit-ts/runtime";
        type MyInt = Int;
        type AnotherInt = MyInt;
        type YetAnotherInt = AnotherInt;
        type Test = { value: YetAnotherInt };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("Int");
    });

    it("should detect custom scalar through type alias", () => {
      const code = `
        type DateTime = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: undefined } };
        type MyDateTime = DateTime;
        type Test = { value: MyDateTime };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("DateTime");
    });
  });

  describe("Task 2.4: Nullable / List combination handling", () => {
    it("should detect scalar from nullable union (T | null)", () => {
      const code = `
        import { Int } from "@gqlkit-ts/runtime";
        type Test = { value: Int | null };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("Int");
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should detect scalar from array type (T[])", () => {
      const code = `
        import { Int } from "@gqlkit-ts/runtime";
        type Test = { values: Int[] };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "values");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("Int");
    });

    it("should detect scalar from nullable array elements ((T | null)[])", () => {
      const code = `
        import { Int } from "@gqlkit-ts/runtime";
        type Test = { values: (Int | null)[] };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "values");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("Int");
    });

    it("should detect scalar from nullable array (T[] | null)", () => {
      const code = `
        import { Int } from "@gqlkit-ts/runtime";
        type Test = { values: Int[] | null };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "values");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("Int");
    });

    it("should handle undefined in union", () => {
      const code = `
        import { Int } from "@gqlkit-ts/runtime";
        type Test = { value: Int | undefined };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("Int");
    });
  });

  describe("Task 2.5: Mixed scalar union error detection", () => {
    it("should detect error for union of different scalars (Int | IDString)", () => {
      const code = `
        import { Int, IDString } from "@gqlkit-ts/runtime";
        type Test = { value: Int | IDString };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = validateNoMixedScalarUnion(type, checker);

      expect(result).toHaveLength(1);
      expect(result[0]?.code).toBe("CONFLICTING_SCALAR_TYPE");
      expect(result[0]?.message).toContain("Int");
      expect(result[0]?.message).toContain("ID");
    });

    it("should detect error for union of custom scalars with different names", () => {
      const code = `
        type DateTime = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: undefined } };
        type URL = string & { " $gqlkitScalar"?: { name: "URL"; only: undefined } };
        type Test = { value: DateTime | URL };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = validateNoMixedScalarUnion(type, checker);

      expect(result).toHaveLength(1);
      expect(result[0]?.code).toBe("CONFLICTING_SCALAR_TYPE");
      expect(result[0]?.message).toContain("DateTime");
      expect(result[0]?.message).toContain("URL");
    });

    it("should not report error for union of same scalar with null", () => {
      const code = `
        import { Int } from "@gqlkit-ts/runtime";
        type Test = { value: Int | null };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = validateNoMixedScalarUnion(type, checker);

      expect(result).toHaveLength(0);
    });

    it("should not report error for union of scalar with undefined", () => {
      const code = `
        import { Int } from "@gqlkit-ts/runtime";
        type Test = { value: Int | undefined };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = validateNoMixedScalarUnion(type, checker);

      expect(result).toHaveLength(0);
    });
  });

  describe("Task 2.6: Built-in scalar collision avoidance", () => {
    it("should not error when user defines type named String", () => {
      const code = `
        export type String = { customField: string };
        type Test = { value: string };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("String");
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should not error when user defines type named Int", () => {
      const code = `
        export type Int = { customField: number };
        type Test = { value: number };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("Float");
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should detect runtime Int even when user has local Int type", () => {
      const code = `
        import { Int as RuntimeInt } from "@gqlkit-ts/runtime";
        export type Int = { customField: number };
        type Test = { value: RuntimeInt };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("Int");
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should detect built-in scalar only from TypeScript primitives and runtime types", () => {
      const code = `
        type Test = {
          str: string;
          num: number;
          bool: boolean;
        };
      `;
      const { checker, sourceFile } = createTestProgram(code);

      const strType = getPropertyType(sourceFile, checker, "Test", "str");
      const numType = getPropertyType(sourceFile, checker, "Test", "num");
      const boolType = getPropertyType(sourceFile, checker, "Test", "bool");

      expect(
        detectScalarMetadata(strType, checker).scalarInfo?.scalarName,
      ).toBe("String");
      expect(
        detectScalarMetadata(numType, checker).scalarInfo?.scalarName,
      ).toBe("Float");
      expect(
        detectScalarMetadata(boolType, checker).scalarInfo?.scalarName,
      ).toBe("Boolean");
    });
  });

  describe("Task 6.1: TSDoc comment description extraction", () => {
    it("should extract TSDoc description from scalar type", () => {
      const code = `
        /**
         * ISO 8601 format date-time string.
         */
        type DateTime = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: undefined } };
        type Test = { value: DateTime };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("DateTime");
      expect(result.scalarInfo?.description).toBe(
        "ISO 8601 format date-time string.",
      );
    });

    it("should extract TSDoc description from DefineScalar type", () => {
      const code = `
        import { DefineScalar } from "@gqlkit-ts/runtime";

        /**
         * Custom scalar for URLs.
         */
        type URL = DefineScalar<"URL", string>;
        type Test = { value: URL };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("URL");
      expect(result.scalarInfo?.description).toBe("Custom scalar for URLs.");
    });

    it("should extract multi-line TSDoc description", () => {
      const code = `
        /**
         * A date-time scalar type.
         * Represents date and time in ISO 8601 format.
         */
        type DateTime = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: undefined } };
        type Test = { value: DateTime };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("DateTime");
      expect(result.scalarInfo?.description).toBe(
        "A date-time scalar type.\nRepresents date and time in ISO 8601 format.",
      );
    });

    it("should return null description when no TSDoc comment exists", () => {
      const code = `
        type DateTime = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: undefined } };
        type Test = { value: DateTime };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("DateTime");
      expect(result.scalarInfo?.description).toBeNull();
    });

    it("should extract description from custom scalar type defined with DefineScalar", () => {
      const code = `
        import { DefineScalar } from "@gqlkit-ts/runtime";

        /**
         * Positive integer representing count.
         */
        type Count = DefineScalar<"Count", number>;
        type Test = { value: Count };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo?.scalarName).toBe("Count");
      expect(result.scalarInfo?.description).toBe(
        "Positive integer representing count.",
      );
    });
  });

  describe("Edge cases", () => {
    it("should return null scalarInfo for object types", () => {
      const code = `
        type User = { id: string; name: string };
        type Test = { user: User };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "user");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo).toBeNull();
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should return null scalarInfo for union of object types", () => {
      const code = `
        type A = { type: "a" };
        type B = { type: "b" };
        type Test = { value: A | B };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "value");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo).toBeNull();
    });

    it("should return null scalarInfo for enum types", () => {
      const code = `
        enum Status { Active = "ACTIVE", Inactive = "INACTIVE" }
        type Test = { status: Status };
      `;
      const { checker, sourceFile } = createTestProgram(code);
      const type = getPropertyType(sourceFile, checker, "Test", "status");
      const result = detectScalarMetadata(type, checker);

      expect(result.scalarInfo).toBeNull();
    });
  });
});
