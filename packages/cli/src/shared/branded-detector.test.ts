import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type DetectionResult,
  detectBrandedScalar,
  isBrandedScalarType,
  type ScalarTypeInfo,
} from "./branded-detector.js";
import { createScalarRegistry } from "./scalar-registry.js";

describe("BrandedDetector", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "branded-detector-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  function createProgram(files: Record<string, string>): ts.Program {
    const runtimePath = path.join(tempDir, "node_modules/@gqlkit-ts/runtime");
    fs.mkdirSync(runtimePath, { recursive: true });
    fs.writeFileSync(
      path.join(runtimePath, "index.d.ts"),
      `
declare const ScalarBrandSymbol: unique symbol;
export type ScalarBrand<K extends string> = { readonly [ScalarBrandSymbol]: K };
export type IDString = string & ScalarBrand<"IDString">;
export type IDNumber = number & ScalarBrand<"IDNumber">;
export type Int = number & ScalarBrand<"Int">;
export type Float = number & ScalarBrand<"Float">;
`,
    );

    const filePaths: string[] = [];
    for (const [name, content] of Object.entries(files)) {
      const filePath = path.join(tempDir, name);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
      filePaths.push(filePath);
    }

    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.Node16,
      strict: true,
      baseUrl: tempDir,
      paths: {
        "@gqlkit-ts/runtime": ["./node_modules/@gqlkit-ts/runtime/index.d.ts"],
      },
    };

    return ts.createProgram(filePaths, options);
  }

  function getFieldType(
    program: ts.Program,
    fileName: string,
    typeName: string,
    fieldName: string,
  ): ts.Type | undefined {
    const filePath = path.join(tempDir, fileName);
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) return undefined;

    const checker = program.getTypeChecker();
    let fieldType: ts.Type | undefined;

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
        const name = node.name.getText(sourceFile);
        if (name === typeName) {
          const typeSymbol = checker.getSymbolAtLocation(node.name);
          if (typeSymbol) {
            const type = checker.getDeclaredTypeOfSymbol(typeSymbol);
            const prop = type.getProperty(fieldName);
            if (prop) {
              fieldType = checker.getTypeOfSymbol(prop);
            }
          }
        }
      }
    });

    return fieldType;
  }

  describe("detectBrandedScalar", () => {
    it("should detect IDString and return ScalarTypeInfo with ID scalar", () => {
      const program = createProgram({
        "src/types.ts": `
import { IDString } from "@gqlkit-ts/runtime";
export type User = { id: IDString };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(program, "src/types.ts", "User", "id");
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker);
      expect(result.scalarInfo).toBeTruthy();
      expect(result.scalarInfo!.scalarName).toBe("ID");
      expect(result.scalarInfo!.brandName).toBe("IDString");
      expect(result.scalarInfo!.baseType).toBe("string");
      expect(result.diagnostics.length).toBe(0);
    });

    it("should detect IDNumber and return ScalarTypeInfo with ID scalar", () => {
      const program = createProgram({
        "src/types.ts": `
import { IDNumber } from "@gqlkit-ts/runtime";
export type User = { numericId: IDNumber };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(
        program,
        "src/types.ts",
        "User",
        "numericId",
      );
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker);
      expect(result.scalarInfo).toBeTruthy();
      expect(result.scalarInfo!.scalarName).toBe("ID");
      expect(result.scalarInfo!.brandName).toBe("IDNumber");
      expect(result.scalarInfo!.baseType).toBe("number");
    });

    it("should detect Int and return ScalarTypeInfo with Int scalar", () => {
      const program = createProgram({
        "src/types.ts": `
import { Int } from "@gqlkit-ts/runtime";
export type Product = { count: Int };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(
        program,
        "src/types.ts",
        "Product",
        "count",
      );
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker);
      expect(result.scalarInfo).toBeTruthy();
      expect(result.scalarInfo!.scalarName).toBe("Int");
      expect(result.scalarInfo!.brandName).toBe("Int");
      expect(result.scalarInfo!.baseType).toBe("number");
    });

    it("should detect Float and return ScalarTypeInfo with Float scalar", () => {
      const program = createProgram({
        "src/types.ts": `
import { Float } from "@gqlkit-ts/runtime";
export type Product = { price: Float };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(
        program,
        "src/types.ts",
        "Product",
        "price",
      );
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker);
      expect(result.scalarInfo).toBeTruthy();
      expect(result.scalarInfo!.scalarName).toBe("Float");
      expect(result.scalarInfo!.brandName).toBe("Float");
      expect(result.scalarInfo!.baseType).toBe("number");
    });

    it("should return undefined scalarInfo for plain string type", () => {
      const program = createProgram({
        "src/types.ts": `
export type User = { name: string };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(program, "src/types.ts", "User", "name");
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker);
      expect(result.scalarInfo).toBe(undefined);
    });

    it("should return undefined scalarInfo for plain number type", () => {
      const program = createProgram({
        "src/types.ts": `
export type User = { age: number };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(program, "src/types.ts", "User", "age");
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker);
      expect(result.scalarInfo).toBe(undefined);
    });

    it("should return undefined scalarInfo for boolean type", () => {
      const program = createProgram({
        "src/types.ts": `
export type User = { active: boolean };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(program, "src/types.ts", "User", "active");
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker);
      expect(result.scalarInfo).toBe(undefined);
    });

    it("should return undefined scalarInfo for reference type", () => {
      const program = createProgram({
        "src/types.ts": `
type Address = { city: string };
export type User = { address: Address };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(
        program,
        "src/types.ts",
        "User",
        "address",
      );
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker);
      expect(result.scalarInfo).toBe(undefined);
    });

    it("should work with re-exported branded types", () => {
      const program = createProgram({
        "src/scalars.ts": `
export { IDString } from "@gqlkit-ts/runtime";
`,
        "src/types.ts": `
import { IDString } from "./scalars.js";
export type User = { id: IDString };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(program, "src/types.ts", "User", "id");
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker);
      expect(result.scalarInfo).toBeTruthy();
      expect(result.scalarInfo!.scalarName).toBe("ID");
      expect(result.scalarInfo!.brandName).toBe("IDString");
    });
  });

  describe("isBrandedScalarType", () => {
    it("should return true for IDString", () => {
      const program = createProgram({
        "src/types.ts": `
import { IDString } from "@gqlkit-ts/runtime";
export type User = { id: IDString };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(program, "src/types.ts", "User", "id");
      expect(fieldType).toBeTruthy();

      expect(isBrandedScalarType(fieldType!, checker)).toBe(true);
    });

    it("should return true for Int", () => {
      const program = createProgram({
        "src/types.ts": `
import { Int } from "@gqlkit-ts/runtime";
export type Product = { count: Int };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(
        program,
        "src/types.ts",
        "Product",
        "count",
      );
      expect(fieldType).toBeTruthy();

      expect(isBrandedScalarType(fieldType!, checker)).toBe(true);
    });

    it("should return false for plain string", () => {
      const program = createProgram({
        "src/types.ts": `
export type User = { name: string };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(program, "src/types.ts", "User", "name");
      expect(fieldType).toBeTruthy();

      expect(isBrandedScalarType(fieldType!, checker)).toBe(false);
    });

    it("should return false for plain number", () => {
      const program = createProgram({
        "src/types.ts": `
export type User = { age: number };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(program, "src/types.ts", "User", "age");
      expect(fieldType).toBeTruthy();

      expect(isBrandedScalarType(fieldType!, checker)).toBe(false);
    });
  });

  describe("ScalarTypeInfo type", () => {
    it("should have correct shape for standard scalar", () => {
      const info: ScalarTypeInfo = {
        scalarName: "ID",
        brandName: "IDString",
        baseType: "string",
        isCustom: false,
      };
      expect(info).toBeTruthy();
      expect(info.scalarName).toBe("ID");
      expect(info.brandName).toBe("IDString");
      expect(info.baseType).toBe("string");
      expect(info.isCustom).toBe(false);
    });

    it("should have correct shape for custom scalar", () => {
      const info: ScalarTypeInfo = {
        scalarName: "DateTime",
        brandName: "DateTime",
        baseType: undefined,
        isCustom: true,
      };
      expect(info).toBeTruthy();
      expect(info.scalarName).toBe("DateTime");
      expect(info.brandName).toBe("DateTime");
      expect(info.baseType).toBe(undefined);
      expect(info.isCustom).toBe(true);
    });

    it("should support all valid scalarName values", () => {
      const scalars: string[] = [
        "ID",
        "Int",
        "Float",
        "String",
        "Boolean",
        "DateTime",
        "UUID",
      ];
      for (const scalar of scalars) {
        const info: ScalarTypeInfo = {
          scalarName: scalar,
          brandName: "Test",
          baseType: "string",
          isCustom: false,
        };
        expect(info).toBeTruthy();
      }
    });
  });

  describe("DetectionResult type", () => {
    it("should have correct shape with scalarInfo", () => {
      const result: DetectionResult = {
        scalarInfo: {
          scalarName: "ID",
          brandName: "IDString",
          baseType: "string",
          isCustom: false,
        },
        unknownBrand: undefined,
        diagnostics: [],
      };
      expect(result.scalarInfo).toBeTruthy();
      expect(result.unknownBrand).toBe(undefined);
      expect(result.diagnostics.length).toBe(0);
    });

    it("should have correct shape without scalarInfo", () => {
      const result: DetectionResult = {
        scalarInfo: undefined,
        unknownBrand: undefined,
        diagnostics: [],
      };
      expect(result.scalarInfo).toBe(undefined);
      expect(result.unknownBrand).toBe(undefined);
    });

    it("should have correct shape with unknownBrand", () => {
      const result: DetectionResult = {
        scalarInfo: undefined,
        unknownBrand: {
          typeName: "CustomScalar",
          importSource: "@gqlkit-ts/runtime",
        },
        diagnostics: [],
      };
      expect(result.scalarInfo).toBe(undefined);
      expect(result.unknownBrand).toBeTruthy();
      expect(result.unknownBrand!.typeName).toBe("CustomScalar");
      expect(result.unknownBrand!.importSource).toBe("@gqlkit-ts/runtime");
    });
  });

  describe("unknown branded type detection", () => {
    it("should return unknownBrand for unknown types from @gqlkit-ts/runtime", () => {
      const program = createProgram({
        "node_modules/@gqlkit-ts/runtime/index.d.ts": `
declare const ScalarBrandSymbol: unique symbol;
export type ScalarBrand<K extends string> = { readonly [ScalarBrandSymbol]: K };
export type IDString = string & ScalarBrand<"IDString">;
export type IDNumber = number & ScalarBrand<"IDNumber">;
export type Int = number & ScalarBrand<"Int">;
export type Float = number & ScalarBrand<"Float">;
export type UnknownBrandedType = string & ScalarBrand<"UnknownBrandedType">;
`,
        "src/types.ts": `
import type { UnknownBrandedType } from "@gqlkit-ts/runtime";
export type User = { custom: UnknownBrandedType };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(program, "src/types.ts", "User", "custom");
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker);
      expect(result.scalarInfo).toBe(undefined);
      expect(result.unknownBrand).toBeTruthy();
      expect(result.unknownBrand!.typeName).toBe("UnknownBrandedType");
      expect(result.unknownBrand!.importSource).toBe("@gqlkit-ts/runtime");
    });

    it("should not return unknownBrand for types from other modules", () => {
      const program = createProgram({
        "node_modules/other-lib/index.d.ts": `
export type CustomType = string & { readonly __brand: unique symbol };
`,
        "src/types.ts": `
import type { CustomType } from "other-lib";
export type User = { custom: CustomType };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(program, "src/types.ts", "User", "custom");
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker);
      expect(result.scalarInfo).toBe(undefined);
      expect(result.unknownBrand).toBe(undefined);
    });
  });

  describe("custom scalar detection with ScalarRegistry", () => {
    it("should detect custom scalar when registry is provided", () => {
      const program = createProgram({
        "src/scalars.ts": `
export type DateTime = string & { __brand: 'DateTime' };
`,
        "src/types.ts": `
import type { DateTime } from "./scalars.js";
export type Event = { createdAt: DateTime };
`,
      });

      const registry = createScalarRegistry({
        program,
        configDir: tempDir,
        customScalars: [
          {
            graphqlName: "DateTime",
            typeName: "DateTime",
            importPath: "./src/scalars",
          },
        ],
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(
        program,
        "src/types.ts",
        "Event",
        "createdAt",
      );
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker, { registry });
      expect(result.scalarInfo).toBeTruthy();
      expect(result.scalarInfo!.scalarName).toBe("DateTime");
      expect(result.scalarInfo!.brandName).toBe("DateTime");
      expect(result.scalarInfo!.isCustom).toBe(true);
    });

    it("should not detect custom scalar when registry is not provided", () => {
      const program = createProgram({
        "src/scalars.ts": `
export type DateTime = string & { __brand: 'DateTime' };
`,
        "src/types.ts": `
import type { DateTime } from "./scalars.js";
export type Event = { createdAt: DateTime };
`,
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(
        program,
        "src/types.ts",
        "Event",
        "createdAt",
      );
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker);
      expect(result.scalarInfo).toBe(undefined);
    });

    it("should still detect standard branded types when registry is provided", () => {
      const program = createProgram({
        "src/types.ts": `
import { IDString } from "@gqlkit-ts/runtime";
export type User = { id: IDString };
`,
      });

      const registry = createScalarRegistry({
        program,
        configDir: tempDir,
        customScalars: [],
      });

      const checker = program.getTypeChecker();
      const fieldType = getFieldType(program, "src/types.ts", "User", "id");
      expect(fieldType).toBeTruthy();

      const result = detectBrandedScalar(fieldType!, checker, { registry });
      expect(result.scalarInfo).toBeTruthy();
      expect(result.scalarInfo!.scalarName).toBe("ID");
      expect(result.scalarInfo!.brandName).toBe("IDString");
      expect(result.scalarInfo!.isCustom).toBe(false);
    });
  });
});
