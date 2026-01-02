import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { extractTSDocFromSymbol, extractTSDocInfo } from "./tsdoc-parser.js";

const VIRTUAL_ROOT = "/virtual";

function createTestProgram(files: Record<string, string>): {
  program: ts.Program;
  filePaths: string[];
} {
  const absoluteFiles: Record<string, string> = {};
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(VIRTUAL_ROOT, relativePath);
    absoluteFiles[absolutePath] = content;
  }

  const fileNames = Object.keys(absoluteFiles);

  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    strict: true,
    noEmit: true,
    baseUrl: VIRTUAL_ROOT,
  };

  const compilerHost = ts.createCompilerHost(options);

  const originalGetSourceFile = compilerHost.getSourceFile;
  compilerHost.getSourceFile = (
    fileName: string,
    languageVersion: ts.ScriptTarget,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean,
  ): ts.SourceFile | undefined => {
    const content = absoluteFiles[fileName];
    if (content !== undefined) {
      return ts.createSourceFile(fileName, content, languageVersion, true);
    }
    return originalGetSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
  };

  const originalFileExists = compilerHost.fileExists;
  compilerHost.fileExists = (fileName: string): boolean => {
    if (fileName in absoluteFiles) return true;
    return originalFileExists(fileName);
  };

  const originalReadFile = compilerHost.readFile;
  compilerHost.readFile = (fileName: string): string | undefined => {
    if (fileName in absoluteFiles) return absoluteFiles[fileName];
    return originalReadFile(fileName);
  };

  const program = ts.createProgram(fileNames, options, compilerHost);

  return { program, filePaths: fileNames };
}

describe("TSDocParser", () => {
  describe("extractTSDocInfo", () => {
    describe("description extraction", () => {
      it("should extract single-line description from TSDoc comment", () => {
        const { program, filePaths } = createTestProgram({
          "user.ts": `
            /** A user in the system */
            export interface User {
              id: string;
            }
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const interfaceNode = sourceFile.statements[0]!;

        const result = extractTSDocInfo(interfaceNode, checker);

        expect(result.description).toBe("A user in the system");
      });

      it("should extract multi-line description preserving newlines", () => {
        const { program, filePaths } = createTestProgram({
          "user.ts": `
            /**
             * A user in the system.
             * This represents an authenticated user.
             */
            export interface User {
              id: string;
            }
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const interfaceNode = sourceFile.statements[0]!;

        const result = extractTSDocInfo(interfaceNode, checker);

        expect(result.description).toBeTruthy();
        expect(result.description).toContain("A user in the system.");
        expect(result.description).toContain(
          "This represents an authenticated user.",
        );
      });

      it("should extract description from @description tag", () => {
        const { program, filePaths } = createTestProgram({
          "user.ts": `
            /**
             * @description A user in the system
             */
            export interface User {
              id: string;
            }
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const interfaceNode = sourceFile.statements[0]!;

        const result = extractTSDocInfo(interfaceNode, checker);

        expect(result.description).toBe("A user in the system");
      });

      it("should return undefined when no TSDoc comment exists", () => {
        const { program, filePaths } = createTestProgram({
          "user.ts": `
            export interface User {
              id: string;
            }
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const interfaceNode = sourceFile.statements[0]!;

        const result = extractTSDocInfo(interfaceNode, checker);

        expect(result.description).toBe(undefined);
      });

      it("should return undefined for whitespace-only description", () => {
        const { program, filePaths } = createTestProgram({
          "user.ts": `
            /**
             *
             */
            export interface User {
              id: string;
            }
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const interfaceNode = sourceFile.statements[0]!;

        const result = extractTSDocInfo(interfaceNode, checker);

        expect(result.description).toBe(undefined);
      });

      it("should strip leading and trailing whitespace and asterisks", () => {
        const { program, filePaths } = createTestProgram({
          "user.ts": `
            /**
             *   A user in the system
             */
            export interface User {
              id: string;
            }
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const interfaceNode = sourceFile.statements[0]!;

        const result = extractTSDocInfo(interfaceNode, checker);

        expect(result.description).toBe("A user in the system");
      });
    });

    describe("deprecated extraction", () => {
      it("should extract @deprecated tag without reason", () => {
        const { program, filePaths } = createTestProgram({
          "user.ts": `
            /**
             * A user in the system
             * @deprecated
             */
            export interface User {
              id: string;
            }
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const interfaceNode = sourceFile.statements[0]!;

        const result = extractTSDocInfo(interfaceNode, checker);

        expect(result.deprecated).toBeTruthy();
        expect(result.deprecated!.isDeprecated).toBe(true);
        expect(result.deprecated!.reason).toBe(undefined);
      });

      it("should extract @deprecated tag with reason", () => {
        const { program, filePaths } = createTestProgram({
          "user.ts": `
            /**
             * A user in the system
             * @deprecated Use Member instead
             */
            export interface User {
              id: string;
            }
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const interfaceNode = sourceFile.statements[0]!;

        const result = extractTSDocInfo(interfaceNode, checker);

        expect(result.deprecated).toBeTruthy();
        expect(result.deprecated!.isDeprecated).toBe(true);
        expect(result.deprecated!.reason).toBe("Use Member instead");
      });

      it("should return undefined deprecated when no @deprecated tag exists", () => {
        const { program, filePaths } = createTestProgram({
          "user.ts": `
            /** A user in the system */
            export interface User {
              id: string;
            }
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const interfaceNode = sourceFile.statements[0]!;

        const result = extractTSDocInfo(interfaceNode, checker);

        expect(result.deprecated).toBe(undefined);
      });

      it("should extract @deprecated from property symbol", () => {
        const { program, filePaths } = createTestProgram({
          "user.ts": `
            export interface User {
              /**
               * The unique identifier
               * @deprecated Use uuid instead
               */
              id: string;
            }
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const interfaceNode = sourceFile
          .statements[0] as ts.InterfaceDeclaration;
        const symbol = checker.getSymbolAtLocation(interfaceNode.name);
        const type = checker.getDeclaredTypeOfSymbol(symbol!);
        const idProperty = type.getProperty("id");

        expect(idProperty).toBeTruthy();
        const result = extractTSDocFromSymbol(idProperty!, checker);

        expect(result.deprecated).toBeTruthy();
        expect(result.deprecated!.isDeprecated).toBe(true);
        expect(result.deprecated!.reason).toBe("Use uuid instead");
      });
    });

    describe("tag filtering", () => {
      it("should exclude @param tags from description", () => {
        const { program, filePaths } = createTestProgram({
          "resolver.ts": `
            /**
             * Fetches a user by ID
             * @param id - The user ID
             * @param options - Fetch options
             */
            export const getUser = (id: string, options: {}) => ({ id });
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const varStatement = sourceFile.statements[0]!;

        const result = extractTSDocInfo(varStatement, checker);

        expect(result.description).toBe("Fetches a user by ID");
        expect(result.description).not.toContain("@param");
        expect(result.description).not.toContain("user ID");
      });

      it("should exclude @returns tag from description", () => {
        const { program, filePaths } = createTestProgram({
          "resolver.ts": `
            /**
             * Fetches a user by ID
             * @returns The user object
             */
            export const getUser = (id: string) => ({ id });
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const varStatement = sourceFile.statements[0]!;

        const result = extractTSDocInfo(varStatement, checker);

        expect(result.description).toBe("Fetches a user by ID");
        expect(result.description).not.toContain("@returns");
      });

      it("should exclude @example tag from description", () => {
        const { program, filePaths } = createTestProgram({
          "resolver.ts": `
            /**
             * Fetches a user by ID
             * @example
             * getUser("123")
             */
            export const getUser = (id: string) => ({ id });
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const varStatement = sourceFile.statements[0]!;

        const result = extractTSDocInfo(varStatement, checker);

        expect(result.description).toBe("Fetches a user by ID");
        expect(result.description).not.toContain("@example");
      });

      it("should only include description content excluding all non-description tags", () => {
        const { program, filePaths } = createTestProgram({
          "resolver.ts": `
            /**
             * Main description here.
             * With multiple lines.
             * @param id - The ID parameter
             * @returns Some result
             * @deprecated Use v2 instead
             * @example someExample()
             */
            export const someFunc = (id: string) => ({ id });
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const varStatement = sourceFile.statements[0]!;

        const result = extractTSDocInfo(varStatement, checker);

        expect(result.description).toBeTruthy();
        expect(result.description).toContain("Main description here.");
        expect(result.description).toContain("With multiple lines.");
        expect(result.description).not.toContain("@param");
        expect(result.description).not.toContain("@returns");
        expect(result.description).not.toContain("@example");
        expect(result.description).not.toContain("@deprecated");
      });

      it("should exclude @privateRemarks content from description", () => {
        const { program, filePaths } = createTestProgram({
          "user.ts": `
            /**
             * A user in the system
             * @privateRemarks
             * This is internal implementation detail
             */
            export interface User {
              id: string;
            }
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const interfaceNode = sourceFile.statements[0]!;

        const result = extractTSDocInfo(interfaceNode, checker);

        expect(result.description).toBe("A user in the system");
        expect(result.description).not.toContain("@privateRemarks");
        expect(result.description).not.toContain("internal implementation");
      });

      it("should return undefined when only @privateRemarks exists", () => {
        const { program, filePaths } = createTestProgram({
          "user.ts": `
            /**
             * @privateRemarks
             * This is internal implementation detail
             */
            export interface User {
              id: string;
            }
          `,
        });

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(filePaths[0]!)!;
        const interfaceNode = sourceFile.statements[0]!;

        const result = extractTSDocInfo(interfaceNode, checker);

        expect(result.description).toBe(undefined);
      });
    });
  });

  describe("extractTSDocFromSymbol", () => {
    it("should extract description from property symbol", () => {
      const { program, filePaths } = createTestProgram({
        "user.ts": `
          export interface User {
            /** The unique identifier */
            id: string;
          }
        `,
      });

      const checker = program.getTypeChecker();
      const sourceFile = program.getSourceFile(filePaths[0]!)!;
      const interfaceNode = sourceFile.statements[0] as ts.InterfaceDeclaration;
      const symbol = checker.getSymbolAtLocation(interfaceNode.name);
      const type = checker.getDeclaredTypeOfSymbol(symbol!);
      const idProperty = type.getProperty("id");

      expect(idProperty).toBeTruthy();
      const result = extractTSDocFromSymbol(idProperty!, checker);

      expect(result.description).toBe("The unique identifier");
    });

    it("should return undefined for property without TSDoc", () => {
      const { program, filePaths } = createTestProgram({
        "user.ts": `
          export interface User {
            id: string;
          }
        `,
      });

      const checker = program.getTypeChecker();
      const sourceFile = program.getSourceFile(filePaths[0]!)!;
      const interfaceNode = sourceFile.statements[0] as ts.InterfaceDeclaration;
      const symbol = checker.getSymbolAtLocation(interfaceNode.name);
      const type = checker.getDeclaredTypeOfSymbol(symbol!);
      const idProperty = type.getProperty("id");

      expect(idProperty).toBeTruthy();
      const result = extractTSDocFromSymbol(idProperty!, checker);

      expect(result.description).toBe(undefined);
    });
  });
});
