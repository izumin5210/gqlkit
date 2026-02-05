import ts from "typescript";
import {
  getSourceLocationFromNode,
  type SourceLocation,
} from "../../shared/source-location.js";
import {
  isExported,
  resolveOriginalSymbol,
} from "../../shared/typescript-utils.js";
import type { Diagnostic } from "../types/index.js";

/**
 * Tracks location of a type declaration for duplicate detection.
 */
interface TypeDeclarationLocation {
  readonly name: string;
  readonly location: SourceLocation;
}

/**
 * Formats a source location as a human-readable string.
 */
function formatLocation(location: SourceLocation): string {
  return `${location.file}:${location.line}`;
}

export interface TypeNameCollectionResult {
  readonly typeNames: ReadonlySet<string>;
  readonly typeSymbols: ReadonlyMap<string, ts.Symbol>;
  /**
   * Maps underlying type symbols to their schema type names.
   * For `type User = ExternalUser;`, maps ExternalUser's symbol to "User".
   * This allows recognizing `ExternalUser` as `User` in field types.
   */
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
  /**
   * Diagnostics collected during type name collection.
   * Contains errors for duplicate type exports.
   */
  readonly diagnostics: ReadonlyArray<Diagnostic>;
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
  const diagnostics: Diagnostic[] = [];
  const checker = program.getTypeChecker();

  // Track first occurrence of each type name for duplicate detection
  const typeLocations = new Map<string, TypeDeclarationLocation>();

  /**
   * Registers a type name and checks for duplicates.
   * Returns true if this is a new type, false if it's a duplicate.
   */
  function registerTypeName(
    name: string,
    location: SourceLocation,
    symbol: ts.Symbol | undefined,
  ): boolean {
    const existing = typeLocations.get(name);
    if (existing) {
      // Duplicate found - report error
      diagnostics.push({
        code: "DUPLICATE_TYPE_EXPORT",
        message: `Type '${name}' is exported from multiple files. First defined at ${formatLocation(existing.location)}.`,
        severity: "error",
        location,
      });
      return false;
    }
    typeLocations.set(name, { name, location });
    typeNames.add(name);
    if (symbol) {
      typeSymbols.set(name, resolveOriginalSymbol(symbol, checker));
    }
    return true;
  }

  for (const filePath of sourceFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) continue;

    ts.forEachChild(sourceFile, (node) => {
      // Direct type declarations
      if (ts.isTypeAliasDeclaration(node) && isExported(node)) {
        const name = node.name.getText(sourceFile);
        const location = getSourceLocationFromNode(node)!;
        const symbol = checker.getSymbolAtLocation(node.name);
        const isNew = registerTypeName(name, location, symbol);

        if (isNew && symbol) {
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
        const location = getSourceLocationFromNode(node)!;
        const symbol = checker.getSymbolAtLocation(node.name);
        registerTypeName(name, location, symbol);
      }
      if (ts.isEnumDeclaration(node) && isExported(node)) {
        const name = node.name.getText(sourceFile);
        const location = getSourceLocationFromNode(node)!;
        const symbol = checker.getSymbolAtLocation(node.name);
        registerTypeName(name, location, symbol);
      }

      // Re-exports: `export type { ... } from "..."` or `export type * from "..."`
      if (ts.isExportDeclaration(node) && node.isTypeOnly) {
        if (node.exportClause) {
          // Named re-exports: `export type { Foo, Bar } from "..."`
          if (ts.isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements) {
              // Use the exported name (element.name), not the property name
              const name = element.name.getText(sourceFile);
              const location = getSourceLocationFromNode(element)!;
              const symbol = checker.getSymbolAtLocation(element.name);
              registerTypeName(name, location, symbol);
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
                const location = getSourceLocationFromNode(node)!;
                registerTypeName(name, location, exp);
              }
            }
          }
        }
      }
    });
  }

  return { typeNames, typeSymbols, underlyingSymbolToTypeName, diagnostics };
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
