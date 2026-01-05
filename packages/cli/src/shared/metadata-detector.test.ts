/**
 * Tests for scalar metadata detection from intersection types.
 *
 * These tests verify that the MetadataDetector correctly identifies
 * scalar metadata embedded in TypeScript types.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { detectScalarMetadata } from "./metadata-detector.js";

function createTestProgram(sourceCode: string): {
  program: ts.Program;
  sourceFile: ts.SourceFile;
  checker: ts.TypeChecker;
  cleanup: () => void;
} {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "metadata-test-"));
  const filePath = path.join(tempDir, "test.ts");

  fs.writeFileSync(filePath, sourceCode);

  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    strict: true,
    noEmit: true,
  });

  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) {
    throw new Error("Failed to get source file");
  }

  return {
    program,
    sourceFile,
    checker: program.getTypeChecker(),
    cleanup: () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function getTypeFromSource(
  sourceCode: string,
  typeName: string,
): { type: ts.Type; checker: ts.TypeChecker; cleanup: () => void } {
  const { sourceFile, checker, cleanup } = createTestProgram(sourceCode);

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
    cleanup();
    throw new Error(`Type '${typeName}' not found`);
  }

  return { type: foundType, checker, cleanup };
}

describe("MetadataDetector", () => {
  describe("2.1 TypeScript primitive type automatic mapping", () => {
    it("should detect string as GraphQL String", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type TestType = { field: string };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("String");
        expect(result.isPrimitive).toBe(true);
      } finally {
        cleanup();
      }
    });

    it("should detect boolean as GraphQL Boolean", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type TestType = { field: boolean };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("Boolean");
        expect(result.isPrimitive).toBe(true);
      } finally {
        cleanup();
      }
    });

    it("should detect number as GraphQL Float", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type TestType = { field: number };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("Float");
        expect(result.isPrimitive).toBe(true);
      } finally {
        cleanup();
      }
    });
  });

  describe("2.2 Scalar metadata detection from intersection types", () => {
    it("should detect scalar metadata from intersection type with $gqlkitScalar property", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type DateTime = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: undefined } };`,
        "DateTime",
      );
      try {
        const result = detectScalarMetadata(type, checker);

        expect(result.scalarName).toBe("DateTime");
        expect(result.only).toBeNull();
        expect(result.isPrimitive).toBe(false);
      } finally {
        cleanup();
      }
    });

    it("should extract name from scalar metadata", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type URL = string & { " $gqlkitScalar"?: { name: "URL"; only: undefined } };`,
        "URL",
      );
      try {
        const result = detectScalarMetadata(type, checker);

        expect(result.scalarName).toBe("URL");
      } finally {
        cleanup();
      }
    });

    it("should extract only: input from scalar metadata", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type DateTimeInput = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: "input" } };`,
        "DateTimeInput",
      );
      try {
        const result = detectScalarMetadata(type, checker);

        expect(result.scalarName).toBe("DateTime");
        expect(result.only).toBe("input");
      } finally {
        cleanup();
      }
    });

    it("should extract only: output from scalar metadata", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type DateTimeOutput = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: "output" } };`,
        "DateTimeOutput",
      );
      try {
        const result = detectScalarMetadata(type, checker);

        expect(result.scalarName).toBe("DateTime");
        expect(result.only).toBe("output");
      } finally {
        cleanup();
      }
    });

    it("should detect Int-like scalar from intersection type", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type Int = number & { " $gqlkitScalar"?: { name: "Int"; only: undefined } };
         type TestType = { count: Int };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("Int");
      } finally {
        cleanup();
      }
    });

    it("should detect ID-like scalar from intersection type", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type IDString = string & { " $gqlkitScalar"?: { name: "ID"; only: undefined } };
         type TestType = { id: IDString };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("ID");
      } finally {
        cleanup();
      }
    });
  });

  describe("2.3 Type alias chain tracking", () => {
    it("should detect scalar metadata through single type alias", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type Int = number & { " $gqlkitScalar"?: { name: "Int"; only: undefined } };
         type MyInt = Int;`,
        "MyInt",
      );
      try {
        const result = detectScalarMetadata(type, checker);

        expect(result.scalarName).toBe("Int");
      } finally {
        cleanup();
      }
    });

    it("should detect scalar metadata through multiple type alias chain", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type Int = number & { " $gqlkitScalar"?: { name: "Int"; only: undefined } };
         type MyInt = Int;
         type AnotherInt = MyInt;`,
        "AnotherInt",
      );
      try {
        const result = detectScalarMetadata(type, checker);

        expect(result.scalarName).toBe("Int");
      } finally {
        cleanup();
      }
    });

    it("should detect custom scalar through alias chain", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type DateTime = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: undefined } };
         type MyDateTime = DateTime;
         type AnotherDateTime = MyDateTime;`,
        "AnotherDateTime",
      );
      try {
        const result = detectScalarMetadata(type, checker);

        expect(result.scalarName).toBe("DateTime");
      } finally {
        cleanup();
      }
    });
  });

  describe("2.4 Nullable / List combination handling", () => {
    it("should detect nullable scalar type", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type Int = number & { " $gqlkitScalar"?: { name: "Int"; only: undefined } };
         type TestType = { value: Int | null };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("Int");
        expect(result.nullable).toBe(true);
      } finally {
        cleanup();
      }
    });

    it("should detect list of scalar type", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type Int = number & { " $gqlkitScalar"?: { name: "Int"; only: undefined } };
         type TestType = { values: Int[] };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("Int");
        expect(result.isList).toBe(true);
        expect(result.listItemNullable).toBe(false);
      } finally {
        cleanup();
      }
    });

    it("should detect list of nullable scalar type: (Int | null)[]", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type Int = number & { " $gqlkitScalar"?: { name: "Int"; only: undefined } };
         type TestType = { values: (Int | null)[] };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("Int");
        expect(result.isList).toBe(true);
        expect(result.listItemNullable).toBe(true);
      } finally {
        cleanup();
      }
    });

    it("should detect nullable list of scalar type: Int[] | null", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type Int = number & { " $gqlkitScalar"?: { name: "Int"; only: undefined } };
         type TestType = { values: Int[] | null };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("Int");
        expect(result.isList).toBe(true);
        expect(result.nullable).toBe(true);
        expect(result.listItemNullable).toBe(false);
      } finally {
        cleanup();
      }
    });

    it("should detect nullable primitive type: string | null", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type TestType = { value: string | null };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("String");
        expect(result.nullable).toBe(true);
      } finally {
        cleanup();
      }
    });
  });

  describe("2.5 Different scalar union error detection", () => {
    it("should detect error for union of different scalars: Int | IDString", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type Int = number & { " $gqlkitScalar"?: { name: "Int"; only: undefined } };
         type IDString = string & { " $gqlkitScalar"?: { name: "ID"; only: undefined } };
         type TestType = { field: Int | IDString };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe("MIXED_SCALAR_UNION");
        expect(result.error?.scalarNames).toContain("Int");
        expect(result.error?.scalarNames).toContain("ID");
      } finally {
        cleanup();
      }
    });

    it("should detect error for union of different custom scalars", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type DateTime = Date & { " $gqlkitScalar"?: { name: "DateTime"; only: undefined } };
         type MyURL = string & { " $gqlkitScalar"?: { name: "MyURL"; only: undefined } };
         type TestType = { field: DateTime | MyURL };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe("MIXED_SCALAR_UNION");
        expect(result.error?.scalarNames).toContain("DateTime");
        expect(result.error?.scalarNames).toContain("MyURL");
      } finally {
        cleanup();
      }
    });

    it("should not error for same scalar in union (nullable)", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type Int = number & { " $gqlkitScalar"?: { name: "Int"; only: undefined } };
         type TestType = { field: Int | null };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.error).toBeUndefined();
        expect(result.scalarName).toBe("Int");
      } finally {
        cleanup();
      }
    });
  });

  describe("2.6 Built-in scalar collision avoidance", () => {
    it("should not conflict when user defines type named String", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type String = { custom: true };
         type TestType = { field: string };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("String");
        expect(result.isPrimitive).toBe(true);
        expect(result.error).toBeUndefined();
      } finally {
        cleanup();
      }
    });

    it("should not conflict when user defines type named Int", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type Int = { custom: true };
         type RuntimeInt = number & { " $gqlkitScalar"?: { name: "Int"; only: undefined } };
         type TestType = { field: RuntimeInt };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("Int");
        expect(result.error).toBeUndefined();
      } finally {
        cleanup();
      }
    });

    it("should detect built-in scalar from metadata types only", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type Float = number & { " $gqlkitScalar"?: { name: "Float"; only: undefined } };
         type TestType = { field: Float };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBe("Float");
      } finally {
        cleanup();
      }
    });
  });

  describe("Non-scalar types", () => {
    it("should return null for object types", () => {
      const { type, checker, cleanup } = getTypeFromSource(
        `type User = { name: string };
         type TestType = { user: User };`,
        "TestType",
      );
      try {
        const fieldType = type.getProperties()[0];
        if (!fieldType) throw new Error("No field found");

        const propType = checker.getTypeOfSymbol(fieldType);
        const result = detectScalarMetadata(propType, checker);

        expect(result.scalarName).toBeNull();
        expect(result.isObjectType).toBe(true);
      } finally {
        cleanup();
      }
    });
  });
});
