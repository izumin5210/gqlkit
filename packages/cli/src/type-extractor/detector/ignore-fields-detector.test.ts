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

import { serverFS } from "typescript/fs";
import { describe, expect, it } from "vitest";
import * as ts from "../../core/typescript.js";
import {
  type CheckerLoader,
  createCheckerLoader,
} from "../../shared/checker-loader.js";
import { detectIgnoreFieldsMetadata } from "./ignore-fields-detector.js";

const VIRTUAL_DIR = "/virtual";
const VIRTUAL_FILE = `${VIRTUAL_DIR}/test.ts`;

interface TestProgram {
  readonly checker: CheckerLoader;
  readonly sourceFile: ts.SourceFile;
}

async function withTestProgram(
  source: string,
  fn: (testProgram: TestProgram) => Promise<void>,
): Promise<void> {
  const api = new ts.API({
    cwd: VIRTUAL_DIR,
    fs: {
      directoryExists: (dir) => (dir === VIRTUAL_DIR ? true : serverFS.useOS),
      fileExists: (file) => (file === VIRTUAL_FILE ? true : serverFS.useOS),
      getAccessibleEntries: serverFS.useOS,
      readFile: (file) => (file === VIRTUAL_FILE ? source : serverFS.useOS),
      realpath: (path) =>
        path === VIRTUAL_FILE ? serverFS.identity : serverFS.useOS,
      stat: serverFS.useOS,
      writeFile: serverFS.noop,
      removeFile: serverFS.noop,
    },
  });
  try {
    const program = await api.createProgram([VIRTUAL_FILE], {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    });

    const sourceFile = await program.getSourceFile(VIRTUAL_FILE);
    if (!sourceFile) {
      throw new Error("Failed to get source file");
    }

    await fn({
      checker: createCheckerLoader({
        api,
        checker: program.getProject().checker,
      }),
      sourceFile,
    });
  } finally {
    await api.close();
  }
}

async function getTypeFromDeclaration(
  sourceFile: ts.SourceFile,
  checker: CheckerLoader,
  typeName: string,
): Promise<ts.Type> {
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement)) {
      const name = statement.name.getText(sourceFile);
      if (name === typeName) {
        const symbol = await checker.getSymbolAtLocation(statement.name);
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
    it("returns null for plain object type (non-GqlObject)", async () => {
      const source = `
        type User = {
          id: string;
          name: string;
        };
      `;
      await withTestProgram(source, async ({ checker, sourceFile }) => {
        const type = await getTypeFromDeclaration(sourceFile, checker, "User");

        const result = await detectIgnoreFieldsMetadata({ type, checker });

        expect(result).toBeNull();
      });
    });
  });
});
