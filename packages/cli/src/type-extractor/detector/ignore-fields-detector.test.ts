/**
 * Tests for ignoreFields metadata detection.
 *
 * Most scenarios are covered by golden file tests in testdata/:
 * - ignore-fields-single-field/: Single field ignoreFields
 * - ignore-fields-basic/: Multiple fields ignoreFields
 * - ignore-fields-with-directives/: ignoreFields with other metadata
 *
 * This file only contains tests for edge cases not suitable for golden tests.
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
  describe("edge cases", () => {
    it("returns null for plain object type (non-GqlObject)", () => {
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
  });
});
