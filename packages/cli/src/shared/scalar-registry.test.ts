import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createScalarRegistry,
  getScalarMapping,
  isKnownBrandedScalar,
  type ScalarMappingInfo,
  STANDARD_SCALAR_MAPPINGS,
} from "./scalar-registry.js";

describe("ScalarRegistry", () => {
  describe("STANDARD_SCALAR_MAPPINGS", () => {
    it("should contain exactly 4 standard mappings", () => {
      expect(STANDARD_SCALAR_MAPPINGS.size).toBe(4);
    });

    it("should contain IDString mapping", () => {
      const mapping = STANDARD_SCALAR_MAPPINGS.get("IDString");
      expect(mapping).toBeTruthy();
      expect(mapping!.brandName).toBe("IDString");
      expect(mapping!.graphqlScalar).toBe("ID");
      expect(mapping!.baseType).toBe("string");
    });

    it("should contain IDNumber mapping", () => {
      const mapping = STANDARD_SCALAR_MAPPINGS.get("IDNumber");
      expect(mapping).toBeTruthy();
      expect(mapping!.brandName).toBe("IDNumber");
      expect(mapping!.graphqlScalar).toBe("ID");
      expect(mapping!.baseType).toBe("number");
    });

    it("should contain Int mapping", () => {
      const mapping = STANDARD_SCALAR_MAPPINGS.get("Int");
      expect(mapping).toBeTruthy();
      expect(mapping!.brandName).toBe("Int");
      expect(mapping!.graphqlScalar).toBe("Int");
      expect(mapping!.baseType).toBe("number");
    });

    it("should contain Float mapping", () => {
      const mapping = STANDARD_SCALAR_MAPPINGS.get("Float");
      expect(mapping).toBeTruthy();
      expect(mapping!.brandName).toBe("Float");
      expect(mapping!.graphqlScalar).toBe("Float");
      expect(mapping!.baseType).toBe("number");
    });

    it("should be immutable", () => {
      const mapping = STANDARD_SCALAR_MAPPINGS.get("IDString");
      expect(mapping).toBeTruthy();
      expect(() => {
        (mapping as { brandName: string }).brandName = "Modified";
      }).toThrow();
    });
  });

  describe("getScalarMapping", () => {
    it("should return mapping for IDString", () => {
      const mapping = getScalarMapping("IDString");
      expect(mapping).toBeTruthy();
      expect(mapping!.brandName).toBe("IDString");
      expect(mapping!.graphqlScalar).toBe("ID");
    });

    it("should return mapping for IDNumber", () => {
      const mapping = getScalarMapping("IDNumber");
      expect(mapping).toBeTruthy();
      expect(mapping!.brandName).toBe("IDNumber");
      expect(mapping!.graphqlScalar).toBe("ID");
    });

    it("should return mapping for Int", () => {
      const mapping = getScalarMapping("Int");
      expect(mapping).toBeTruthy();
      expect(mapping!.brandName).toBe("Int");
      expect(mapping!.graphqlScalar).toBe("Int");
    });

    it("should return mapping for Float", () => {
      const mapping = getScalarMapping("Float");
      expect(mapping).toBeTruthy();
      expect(mapping!.brandName).toBe("Float");
      expect(mapping!.graphqlScalar).toBe("Float");
    });

    it("should return undefined for unknown brand name", () => {
      const mapping = getScalarMapping("UnknownType");
      expect(mapping).toBe(undefined);
    });

    it("should return undefined for empty string", () => {
      const mapping = getScalarMapping("");
      expect(mapping).toBe(undefined);
    });
  });

  describe("isKnownBrandedScalar", () => {
    it("should return true for IDString", () => {
      expect(isKnownBrandedScalar("IDString")).toBe(true);
    });

    it("should return true for IDNumber", () => {
      expect(isKnownBrandedScalar("IDNumber")).toBe(true);
    });

    it("should return true for Int", () => {
      expect(isKnownBrandedScalar("Int")).toBe(true);
    });

    it("should return true for Float", () => {
      expect(isKnownBrandedScalar("Float")).toBe(true);
    });

    it("should return false for unknown brand name", () => {
      expect(isKnownBrandedScalar("UnknownType")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isKnownBrandedScalar("")).toBe(false);
    });

    it("should return false for similar but not exact names", () => {
      expect(isKnownBrandedScalar("idstring")).toBe(false);
      expect(isKnownBrandedScalar("ID_STRING")).toBe(false);
      expect(isKnownBrandedScalar("IdString")).toBe(false);
    });
  });

  describe("ScalarMappingInfo type", () => {
    it("should have correct shape", () => {
      const info: ScalarMappingInfo = {
        brandName: "TestBrand",
        graphqlScalar: "String",
        baseType: "string",
      };
      expect(info).toBeTruthy();
      expect(info.brandName).toBe("TestBrand");
      expect(info.graphqlScalar).toBe("String");
      expect(info.baseType).toBe("string");
    });

    it("should support all valid graphqlScalar values", () => {
      const scalars: Array<ScalarMappingInfo["graphqlScalar"]> = [
        "ID",
        "Int",
        "Float",
        "String",
        "Boolean",
      ];
      for (const scalar of scalars) {
        const info: ScalarMappingInfo = {
          brandName: "Test",
          graphqlScalar: scalar,
          baseType: "string",
        };
        expect(info).toBeTruthy();
      }
    });

    it("should support all valid baseType values", () => {
      const baseTypes: Array<ScalarMappingInfo["baseType"]> = [
        "string",
        "number",
      ];
      for (const baseType of baseTypes) {
        const info: ScalarMappingInfo = {
          brandName: "Test",
          graphqlScalar: "String",
          baseType,
        };
        expect(info).toBeTruthy();
      }
    });
  });

  describe("createScalarRegistry", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scalar-registry-test-"));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true });
    });

    function createTestProgram(files: Record<string, string>): ts.Program {
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
      };

      return ts.createProgram(filePaths, options);
    }

    describe("without custom scalars", () => {
      it("should return standard branded type mappings", () => {
        const program = createTestProgram({
          "src/dummy.ts": "export {}",
        });
        const registry = createScalarRegistry({ program });

        const idStringMapping = registry.getMapping(
          "IDString",
          "@gqlkit-ts/runtime",
        );
        expect(idStringMapping).toBeTruthy();
        expect(idStringMapping!.graphqlScalar).toBe("ID");
        expect(idStringMapping!.typeName).toBe("IDString");
        expect(idStringMapping!.isCustom).toBe(false);
      });

      it("should return undefined for unknown types", () => {
        const program = createTestProgram({
          "src/dummy.ts": "export {}",
        });
        const registry = createScalarRegistry({ program });

        const mapping = registry.getMapping("Unknown", "./src/scalars");
        expect(mapping).toBe(undefined);
      });

      it("should return empty custom scalar names", () => {
        const program = createTestProgram({
          "src/dummy.ts": "export {}",
        });
        const registry = createScalarRegistry({ program });

        const names = registry.getCustomScalarNames();
        expect(names).toEqual([]);
      });
    });

    describe("with custom scalars", () => {
      it("should return custom scalar mapping", () => {
        fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
        fs.writeFileSync(
          path.join(tempDir, "src/scalars.ts"),
          "export type DateTime = string & { __brand: 'DateTime' };",
        );

        const program = createTestProgram({
          "src/dummy.ts": "export {}",
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

        const mapping = registry.getMapping(
          "DateTime",
          path.join(tempDir, "src/scalars.ts"),
        );
        expect(mapping).toBeTruthy();
        expect(mapping!.graphqlScalar).toBe("DateTime");
        expect(mapping!.typeName).toBe("DateTime");
        expect(mapping!.isCustom).toBe(true);
      });

      it("should return custom scalar names", () => {
        fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
        fs.writeFileSync(
          path.join(tempDir, "src/scalars.ts"),
          `
export type DateTime = string & { __brand: 'DateTime' };
export type UUID = string & { __brand: 'UUID' };
`,
        );

        const program = createTestProgram({
          "src/dummy.ts": "export {}",
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
            {
              graphqlName: "UUID",
              typeName: "UUID",
              importPath: "./src/scalars",
            },
          ],
        });

        const names = registry.getCustomScalarNames();
        expect([...names].sort()).toEqual(["DateTime", "UUID"]);
      });

      it("should resolve ./src/scalars and ./src/scalars/index.ts to same module", () => {
        fs.mkdirSync(path.join(tempDir, "src/scalars"), { recursive: true });
        fs.writeFileSync(
          path.join(tempDir, "src/scalars/index.ts"),
          "export type DateTime = string & { __brand: 'DateTime' };",
        );

        const program = createTestProgram({
          "src/dummy.ts": "export {}",
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

        const mappingViaDir = registry.getMapping(
          "DateTime",
          path.join(tempDir, "src/scalars/index.ts"),
        );
        expect(mappingViaDir).toBeTruthy();
        expect(mappingViaDir!.graphqlScalar).toBe("DateTime");
      });

      it("should prioritize custom scalars over standard branded types", () => {
        fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
        fs.writeFileSync(
          path.join(tempDir, "src/scalars.ts"),
          "export type IDString = string & { __brand: 'custom' };",
        );

        const program = createTestProgram({
          "src/dummy.ts": "export {}",
        });

        const registry = createScalarRegistry({
          program,
          configDir: tempDir,
          customScalars: [
            {
              graphqlName: "CustomID",
              typeName: "IDString",
              importPath: "./src/scalars",
            },
          ],
        });

        const runtimeMapping = registry.getMapping(
          "IDString",
          "@gqlkit-ts/runtime",
        );
        expect(runtimeMapping).toBeTruthy();
        expect(runtimeMapping!.graphqlScalar).toBe("ID");
        expect(runtimeMapping!.isCustom).toBe(false);

        const customMapping = registry.getMapping(
          "IDString",
          path.join(tempDir, "src/scalars.ts"),
        );
        expect(customMapping).toBeTruthy();
        expect(customMapping!.graphqlScalar).toBe("CustomID");
        expect(customMapping!.isCustom).toBe(true);
      });
    });
  });
});
