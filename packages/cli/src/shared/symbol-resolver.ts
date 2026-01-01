/**
 * Symbol resolution utilities for detecting branded scalar types.
 *
 * This module provides functions to resolve the origin of TypeScript symbols
 * and determine if they come from @gqlkit-ts/runtime package.
 */

import ts from "typescript";

/**
 * Represents the origin information of a TypeScript symbol.
 */
export interface SymbolOrigin {
  /** The module name where the symbol is defined */
  readonly moduleName: string;
  /** The exported name of the symbol */
  readonly symbolName: string;
  /** Whether the symbol is from @gqlkit-ts/runtime */
  readonly isFromRuntime: boolean;
}

const GQLKIT_RUNTIME_MODULE = "@gqlkit-ts/runtime";

/**
 * Resolves the origin of a TypeScript symbol.
 *
 * This function traces the symbol back to its original definition
 * to determine which module it comes from.
 *
 * @param symbol - The TypeScript symbol to resolve
 * @param checker - The TypeScript type checker
 * @returns The origin information if resolvable, undefined otherwise
 */
export function resolveSymbolOrigin(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): SymbolOrigin | undefined {
  const symbolName = symbol.getName();

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return {
      moduleName: "",
      symbolName,
      isFromRuntime: false,
    };
  }

  for (const declaration of declarations) {
    const sourceFile = declaration.getSourceFile();
    const fileName = sourceFile.fileName;

    if (
      fileName.includes("@gqlkit-ts/runtime") ||
      fileName.includes("gqlkit-ts/runtime") ||
      fileName.includes("/packages/runtime/src/")
    ) {
      return {
        moduleName: GQLKIT_RUNTIME_MODULE,
        symbolName,
        isFromRuntime: true,
      };
    }

    if (ts.isImportSpecifier(declaration)) {
      const importDecl = declaration.parent.parent.parent;
      if (ts.isImportDeclaration(importDecl)) {
        const moduleSpecifier = importDecl.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const moduleName = moduleSpecifier.text;
          if (moduleName === GQLKIT_RUNTIME_MODULE) {
            return {
              moduleName: GQLKIT_RUNTIME_MODULE,
              symbolName,
              isFromRuntime: true,
            };
          }
        }
      }
    }

    if (ts.isImportClause(declaration) || ts.isImportSpecifier(declaration)) {
      if (symbol.flags & ts.SymbolFlags.Alias) {
        try {
          const aliasedSymbol = checker.getAliasedSymbol(symbol);
          if (aliasedSymbol && aliasedSymbol !== symbol) {
            return resolveSymbolOrigin(aliasedSymbol, checker);
          }
        } catch {
          // getAliasedSymbol can throw for non-alias symbols
        }
      }
    }

    if (ts.isExportSpecifier(declaration)) {
      const exportDecl = declaration.parent.parent;
      if (ts.isExportDeclaration(exportDecl) && exportDecl.moduleSpecifier) {
        if (ts.isStringLiteral(exportDecl.moduleSpecifier)) {
          const moduleName = exportDecl.moduleSpecifier.text;
          if (moduleName === GQLKIT_RUNTIME_MODULE) {
            return {
              moduleName: GQLKIT_RUNTIME_MODULE,
              symbolName,
              isFromRuntime: true,
            };
          }
        }
      }

      const localSymbol =
        checker.getExportSpecifierLocalTargetSymbol(declaration);
      if (localSymbol && localSymbol !== symbol) {
        return resolveSymbolOrigin(localSymbol, checker);
      }
    }
  }

  return {
    moduleName: "",
    symbolName,
    isFromRuntime: false,
  };
}

/**
 * Checks if a symbol is from @gqlkit-ts/runtime package.
 *
 * @param symbol - The TypeScript symbol to check
 * @param checker - The TypeScript type checker
 * @returns true if the symbol is from @gqlkit-ts/runtime, false otherwise
 */
export function isSymbolFromGqlkitRuntime(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): boolean {
  const origin = resolveSymbolOrigin(symbol, checker);
  return origin?.isFromRuntime ?? false;
}
