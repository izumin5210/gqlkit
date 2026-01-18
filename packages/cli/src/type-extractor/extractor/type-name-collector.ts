import ts from "typescript";
import {
  isExported,
  resolveOriginalSymbol,
} from "../../shared/typescript-utils.js";

export interface TypeNameCollectionResult {
  readonly typeNames: ReadonlySet<string>;
  readonly typeSymbols: ReadonlyMap<string, ts.Symbol>;
  /**
   * Maps underlying type symbols to their schema type names.
   * For `type User = ExternalUser;`, maps ExternalUser's symbol to "User".
   * This allows recognizing `ExternalUser` as `User` in field types.
   */
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
}

/**
 * Collects all declared type names from exported type declarations.
 *
 * Used in Phase 1 of the 2-phase type extraction process to gather
 * all schema-defined type names before processing field types.
 *
 * Handles:
 * - Direct type declarations (type, interface, enum)
 * - Named re-exports: `export type { Foo } from "..."`
 * - Wildcard re-exports: `export type * from "..."`
 */
export function collectDeclaredTypeNames(
  program: ts.Program,
  sourceFiles: ReadonlyArray<string>,
): TypeNameCollectionResult {
  const typeNames = new Set<string>();
  const typeSymbols = new Map<string, ts.Symbol>();
  const underlyingSymbolToTypeName = new Map<ts.Symbol, string>();
  const checker = program.getTypeChecker();

  for (const filePath of sourceFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) continue;

    ts.forEachChild(sourceFile, (node) => {
      // Direct type declarations
      if (ts.isTypeAliasDeclaration(node) && isExported(node)) {
        const name = node.name.getText(sourceFile);
        typeNames.add(name);
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
          typeSymbols.set(name, resolveOriginalSymbol(symbol, checker));

          // For type aliases like `type User = ExternalUser;`,
          // also track the underlying type's symbol
          const type = checker.getTypeAtLocation(node.type);
          if (type.symbol) {
            const underlyingSymbol = resolveOriginalSymbol(
              type.symbol,
              checker,
            );
            underlyingSymbolToTypeName.set(underlyingSymbol, name);
          }
        }
      }
      if (ts.isInterfaceDeclaration(node) && isExported(node)) {
        const name = node.name.getText(sourceFile);
        typeNames.add(name);
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
          typeSymbols.set(name, resolveOriginalSymbol(symbol, checker));
        }
      }
      if (ts.isEnumDeclaration(node) && isExported(node)) {
        const name = node.name.getText(sourceFile);
        typeNames.add(name);
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
          typeSymbols.set(name, resolveOriginalSymbol(symbol, checker));
        }
      }

      // Re-exports: `export type { ... } from "..."` or `export type * from "..."`
      if (ts.isExportDeclaration(node) && node.isTypeOnly) {
        if (node.exportClause) {
          // Named re-exports: `export type { Foo, Bar } from "..."`
          if (ts.isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements) {
              // Use the exported name (element.name), not the property name
              const name = element.name.getText(sourceFile);
              typeNames.add(name);
              const symbol = checker.getSymbolAtLocation(element.name);
              if (symbol) {
                typeSymbols.set(name, resolveOriginalSymbol(symbol, checker));
              }
            }
          }
        } else if (node.moduleSpecifier) {
          // Wildcard re-exports: `export type * from "..."`
          const moduleSymbol = checker.getSymbolAtLocation(
            node.moduleSpecifier,
          );
          if (moduleSymbol) {
            const exports = checker.getExportsOfModule(moduleSymbol);
            for (const exp of exports) {
              const name = exp.getName();
              // Check if the export is a type (not a value)
              if (isTypeExport(exp)) {
                typeNames.add(name);
                typeSymbols.set(name, resolveOriginalSymbol(exp, checker));
              }
            }
          }
        }
      }
    });
  }

  return { typeNames, typeSymbols, underlyingSymbolToTypeName };
}

/**
 * Checks if a symbol represents a type export (not a value export).
 */
function isTypeExport(symbol: ts.Symbol): boolean {
  const flags = symbol.flags;
  return (
    (flags & ts.SymbolFlags.Type) !== 0 ||
    (flags & ts.SymbolFlags.TypeAlias) !== 0 ||
    (flags & ts.SymbolFlags.Interface) !== 0 ||
    (flags & ts.SymbolFlags.Enum) !== 0
  );
}
