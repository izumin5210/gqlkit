import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import ts from "typescript";
import {
  isSymbolFromGqlkitRuntime,
  resolveSymbolOrigin,
  type SymbolOrigin,
} from "./symbol-resolver.js";

describe("SymbolResolver", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "symbol-resolver-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  function createProgram(
    files: Record<string, string>,
    runtimeStub?: string,
  ): ts.Program {
    const runtimePath = path.join(tempDir, "node_modules/@gqlkit-ts/runtime");
    fs.mkdirSync(runtimePath, { recursive: true });
    fs.writeFileSync(
      path.join(runtimePath, "index.d.ts"),
      runtimeStub ??
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

  function getTypeSymbol(
    program: ts.Program,
    fileName: string,
    typeName: string,
  ): ts.Symbol | undefined {
    const filePath = path.join(tempDir, fileName);
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) return undefined;

    const checker = program.getTypeChecker();
    let foundSymbol: ts.Symbol | undefined;

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
        const name = node.name.getText(sourceFile);
        if (name === typeName) {
          foundSymbol = checker.getSymbolAtLocation(node.name);
        }
      }
    });

    return foundSymbol;
  }

  describe("resolveSymbolOrigin", () => {
    it("should return origin for symbol imported from @gqlkit-ts/runtime", () => {
      const program = createProgram({
        "src/types.ts": `
import { IDString } from "@gqlkit-ts/runtime";
export type User = { id: IDString };
`,
      });

      const checker = program.getTypeChecker();
      const filePath = path.join(tempDir, "src/types.ts");
      const sourceFile = program.getSourceFile(filePath);
      assert.ok(sourceFile);

      let idFieldSymbol: ts.Symbol | undefined;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isTypeAliasDeclaration(node)) {
          const typeSymbol = checker.getSymbolAtLocation(node.name);
          if (typeSymbol) {
            const type = checker.getDeclaredTypeOfSymbol(typeSymbol);
            const idProp = type.getProperty("id");
            if (idProp) {
              const propType = checker.getTypeOfSymbol(idProp);
              idFieldSymbol = propType.aliasSymbol;
            }
          }
        }
      });

      assert.ok(idFieldSymbol);
      const origin = resolveSymbolOrigin(idFieldSymbol, checker);
      assert.ok(origin);
      assert.equal(origin.symbolName, "IDString");
      assert.equal(origin.isFromRuntime, true);
    });

    it("should return undefined for local type", () => {
      const program = createProgram({
        "src/types.ts": `
export type LocalType = { name: string };
`,
      });

      const checker = program.getTypeChecker();
      const symbol = getTypeSymbol(program, "src/types.ts", "LocalType");
      assert.ok(symbol);

      const origin = resolveSymbolOrigin(symbol, checker);
      assert.ok(origin);
      assert.equal(origin.isFromRuntime, false);
    });

    it("should return undefined for primitive types", () => {
      const program = createProgram({
        "src/types.ts": `
export type MyString = string;
`,
      });

      const checker = program.getTypeChecker();
      const filePath = path.join(tempDir, "src/types.ts");
      const sourceFile = program.getSourceFile(filePath);
      assert.ok(sourceFile);

      ts.forEachChild(sourceFile, (node) => {
        if (ts.isTypeAliasDeclaration(node)) {
          const typeSymbol = checker.getSymbolAtLocation(node.name);
          if (typeSymbol) {
            const origin = resolveSymbolOrigin(typeSymbol, checker);
            assert.ok(origin);
            assert.equal(origin.isFromRuntime, false);
          }
        }
      });
    });

    it("should handle re-exported symbols", () => {
      const program = createProgram({
        "src/scalars.ts": `
export { IDString, Int } from "@gqlkit-ts/runtime";
`,
        "src/types.ts": `
import { IDString } from "./scalars.js";
export type User = { id: IDString };
`,
      });

      const checker = program.getTypeChecker();
      const filePath = path.join(tempDir, "src/types.ts");
      const sourceFile = program.getSourceFile(filePath);
      assert.ok(sourceFile);

      let idFieldSymbol: ts.Symbol | undefined;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isTypeAliasDeclaration(node)) {
          const typeSymbol = checker.getSymbolAtLocation(node.name);
          if (typeSymbol) {
            const type = checker.getDeclaredTypeOfSymbol(typeSymbol);
            const idProp = type.getProperty("id");
            if (idProp) {
              const propType = checker.getTypeOfSymbol(idProp);
              idFieldSymbol = propType.aliasSymbol;
            }
          }
        }
      });

      assert.ok(idFieldSymbol);
      const origin = resolveSymbolOrigin(idFieldSymbol, checker);
      assert.ok(origin);
      assert.equal(origin.symbolName, "IDString");
      assert.equal(origin.isFromRuntime, true);
    });
  });

  describe("isSymbolFromGqlkitRuntime", () => {
    it("should return true for IDString from @gqlkit-ts/runtime", () => {
      const program = createProgram({
        "src/types.ts": `
import { IDString } from "@gqlkit-ts/runtime";
export type User = { id: IDString };
`,
      });

      const checker = program.getTypeChecker();
      const filePath = path.join(tempDir, "src/types.ts");
      const sourceFile = program.getSourceFile(filePath);
      assert.ok(sourceFile);

      let idFieldSymbol: ts.Symbol | undefined;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isTypeAliasDeclaration(node)) {
          const typeSymbol = checker.getSymbolAtLocation(node.name);
          if (typeSymbol) {
            const type = checker.getDeclaredTypeOfSymbol(typeSymbol);
            const idProp = type.getProperty("id");
            if (idProp) {
              const propType = checker.getTypeOfSymbol(idProp);
              idFieldSymbol = propType.aliasSymbol;
            }
          }
        }
      });

      assert.ok(idFieldSymbol);
      assert.equal(isSymbolFromGqlkitRuntime(idFieldSymbol, checker), true);
    });

    it("should return true for Int from @gqlkit-ts/runtime", () => {
      const program = createProgram({
        "src/types.ts": `
import { Int } from "@gqlkit-ts/runtime";
export type Product = { count: Int };
`,
      });

      const checker = program.getTypeChecker();
      const filePath = path.join(tempDir, "src/types.ts");
      const sourceFile = program.getSourceFile(filePath);
      assert.ok(sourceFile);

      let countFieldSymbol: ts.Symbol | undefined;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isTypeAliasDeclaration(node)) {
          const typeSymbol = checker.getSymbolAtLocation(node.name);
          if (typeSymbol) {
            const type = checker.getDeclaredTypeOfSymbol(typeSymbol);
            const countProp = type.getProperty("count");
            if (countProp) {
              const propType = checker.getTypeOfSymbol(countProp);
              countFieldSymbol = propType.aliasSymbol;
            }
          }
        }
      });

      assert.ok(countFieldSymbol);
      assert.equal(isSymbolFromGqlkitRuntime(countFieldSymbol, checker), true);
    });

    it("should return false for local type", () => {
      const program = createProgram({
        "src/types.ts": `
type LocalId = string;
export type User = { id: LocalId };
`,
      });

      const checker = program.getTypeChecker();
      const symbol = getTypeSymbol(program, "src/types.ts", "User");
      assert.ok(symbol);
      assert.equal(isSymbolFromGqlkitRuntime(symbol, checker), false);
    });

    it("should return false for type from other package", () => {
      const program = createProgram({
        "src/types.ts": `
import { SomeType } from "./other.js";
export type User = { data: SomeType };
`,
        "src/other.ts": `
export type SomeType = { value: string };
`,
      });

      const checker = program.getTypeChecker();
      const symbol = getTypeSymbol(program, "src/other.ts", "SomeType");
      assert.ok(symbol);
      assert.equal(isSymbolFromGqlkitRuntime(symbol, checker), false);
    });
  });

  describe("SymbolOrigin type", () => {
    it("should have correct shape", () => {
      const origin: SymbolOrigin = {
        moduleName: "@gqlkit-ts/runtime",
        symbolName: "IDString",
        isFromRuntime: true,
      };
      assert.ok(origin);
      assert.equal(origin.moduleName, "@gqlkit-ts/runtime");
      assert.equal(origin.symbolName, "IDString");
      assert.equal(origin.isFromRuntime, true);
    });
  });
});
