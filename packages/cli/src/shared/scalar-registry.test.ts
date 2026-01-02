import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import ts from "typescript";
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
      assert.equal(STANDARD_SCALAR_MAPPINGS.size, 4);
    });

    it("should contain IDString mapping", () => {
      const mapping = STANDARD_SCALAR_MAPPINGS.get("IDString");
      assert.ok(mapping);
      assert.equal(mapping.brandName, "IDString");
      assert.equal(mapping.graphqlScalar, "ID");
      assert.equal(mapping.baseType, "string");
    });

    it("should contain IDNumber mapping", () => {
      const mapping = STANDARD_SCALAR_MAPPINGS.get("IDNumber");
      assert.ok(mapping);
      assert.equal(mapping.brandName, "IDNumber");
      assert.equal(mapping.graphqlScalar, "ID");
      assert.equal(mapping.baseType, "number");
    });

    it("should contain Int mapping", () => {
      const mapping = STANDARD_SCALAR_MAPPINGS.get("Int");
      assert.ok(mapping);
      assert.equal(mapping.brandName, "Int");
      assert.equal(mapping.graphqlScalar, "Int");
      assert.equal(mapping.baseType, "number");
    });

    it("should contain Float mapping", () => {
      const mapping = STANDARD_SCALAR_MAPPINGS.get("Float");
      assert.ok(mapping);
      assert.equal(mapping.brandName, "Float");
      assert.equal(mapping.graphqlScalar, "Float");
      assert.equal(mapping.baseType, "number");
    });

    it("should be immutable", () => {
      const mapping = STANDARD_SCALAR_MAPPINGS.get("IDString");
      assert.ok(mapping);
      assert.throws(() => {
        (mapping as { brandName: string }).brandName = "Modified";
      });
    });
  });

  describe("getScalarMapping", () => {
    it("should return mapping for IDString", () => {
      const mapping = getScalarMapping("IDString");
      assert.ok(mapping);
      assert.equal(mapping.brandName, "IDString");
      assert.equal(mapping.graphqlScalar, "ID");
    });

    it("should return mapping for IDNumber", () => {
      const mapping = getScalarMapping("IDNumber");
      assert.ok(mapping);
      assert.equal(mapping.brandName, "IDNumber");
      assert.equal(mapping.graphqlScalar, "ID");
    });

    it("should return mapping for Int", () => {
      const mapping = getScalarMapping("Int");
      assert.ok(mapping);
      assert.equal(mapping.brandName, "Int");
      assert.equal(mapping.graphqlScalar, "Int");
    });

    it("should return mapping for Float", () => {
      const mapping = getScalarMapping("Float");
      assert.ok(mapping);
      assert.equal(mapping.brandName, "Float");
      assert.equal(mapping.graphqlScalar, "Float");
    });

    it("should return undefined for unknown brand name", () => {
      const mapping = getScalarMapping("UnknownType");
      assert.equal(mapping, undefined);
    });

    it("should return undefined for empty string", () => {
      const mapping = getScalarMapping("");
      assert.equal(mapping, undefined);
    });
  });

  describe("isKnownBrandedScalar", () => {
    it("should return true for IDString", () => {
      assert.equal(isKnownBrandedScalar("IDString"), true);
    });

    it("should return true for IDNumber", () => {
      assert.equal(isKnownBrandedScalar("IDNumber"), true);
    });

    it("should return true for Int", () => {
      assert.equal(isKnownBrandedScalar("Int"), true);
    });

    it("should return true for Float", () => {
      assert.equal(isKnownBrandedScalar("Float"), true);
    });

    it("should return false for unknown brand name", () => {
      assert.equal(isKnownBrandedScalar("UnknownType"), false);
    });

    it("should return false for empty string", () => {
      assert.equal(isKnownBrandedScalar(""), false);
    });

    it("should return false for similar but not exact names", () => {
      assert.equal(isKnownBrandedScalar("idstring"), false);
      assert.equal(isKnownBrandedScalar("ID_STRING"), false);
      assert.equal(isKnownBrandedScalar("IdString"), false);
    });
  });

  describe("ScalarMappingInfo type", () => {
    it("should have correct shape", () => {
      const info: ScalarMappingInfo = {
        brandName: "TestBrand",
        graphqlScalar: "String",
        baseType: "string",
      };
      assert.ok(info);
      assert.equal(info.brandName, "TestBrand");
      assert.equal(info.graphqlScalar, "String");
      assert.equal(info.baseType, "string");
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
        assert.ok(info);
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
        assert.ok(info);
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
        assert.ok(idStringMapping);
        assert.equal(idStringMapping.graphqlScalar, "ID");
        assert.equal(idStringMapping.typeName, "IDString");
        assert.equal(idStringMapping.isCustom, false);
      });

      it("should return undefined for unknown types", () => {
        const program = createTestProgram({
          "src/dummy.ts": "export {}",
        });
        const registry = createScalarRegistry({ program });

        const mapping = registry.getMapping("Unknown", "./src/scalars");
        assert.equal(mapping, undefined);
      });

      it("should return empty custom scalar names", () => {
        const program = createTestProgram({
          "src/dummy.ts": "export {}",
        });
        const registry = createScalarRegistry({ program });

        const names = registry.getCustomScalarNames();
        assert.deepEqual(names, []);
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
        assert.ok(mapping);
        assert.equal(mapping.graphqlScalar, "DateTime");
        assert.equal(mapping.typeName, "DateTime");
        assert.equal(mapping.isCustom, true);
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
        assert.deepEqual([...names].sort(), ["DateTime", "UUID"]);
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
        assert.ok(mappingViaDir);
        assert.equal(mappingViaDir.graphqlScalar, "DateTime");
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
        assert.ok(runtimeMapping);
        assert.equal(runtimeMapping.graphqlScalar, "ID");
        assert.equal(runtimeMapping.isCustom, false);

        const customMapping = registry.getMapping(
          "IDString",
          path.join(tempDir, "src/scalars.ts"),
        );
        assert.ok(customMapping);
        assert.equal(customMapping.graphqlScalar, "CustomID");
        assert.equal(customMapping.isCustom, true);
      });
    });
  });
});
