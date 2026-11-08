import type { SourceFile } from "typescript/ast";
import {
  isEnumDeclaration,
  isExportDeclaration,
  isInterfaceDeclaration,
  isNamedExports,
  isTypeAliasDeclaration,
} from "typescript/ast/is";
import {
  type Program,
  SymbolFlags,
  type Symbol as TsSymbol,
} from "typescript/async";
import type { Diagnostic, SourceLocation } from "../../core/index.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";
import { prefetchTypeNameFacts } from "../../shared/checker-prefetch.js";
import { getSourceLocationFromNode } from "../../shared/source-location.js";
import {
  getSymbolIdentityKey,
  isExported,
  resolveOriginalSymbol,
  type SymbolKey,
} from "../../shared/typescript-utils.js";

/**
 * Formats a source location as a human-readable string.
 */
function formatLocation(location: SourceLocation): string {
  return `${location.file}:${location.line}`;
}

export interface TypeNameCollectionResult {
  readonly typeNames: ReadonlySet<string>;
  readonly typeSymbols: ReadonlyMap<string, SymbolKey>;
  /**
   * Maps underlying type symbols to their schema type names.
   * For `type User = ExternalUser;`, maps ExternalUser's symbol to "User".
   * This allows recognizing `ExternalUser` as `User` in field types.
   */
  readonly underlyingSymbolToTypeName: ReadonlyMap<SymbolKey, string>;
  /**
   * Diagnostics collected during type name collection.
   * Contains errors for duplicate type exports.
   */
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

/**
 * An exported type name, as the files export it. Registrations are
 * collected per file and registered in file order (see
 * `registerTypeNames`), so ranges of files can be collected separately.
 */
export interface TypeNameRegistration {
  readonly name: string;
  readonly location: SourceLocation;
  /** The exported symbol, through aliases; null if it has none. */
  readonly symbolKey: SymbolKey | null;
  /**
   * For a type alias, the symbol of the type it names, through aliases
   * (`ExternalUser` for `type User = ExternalUser;`); null otherwise.
   */
  readonly underlyingSymbolKey: SymbolKey | null;
}

/**
 * Registers type names in order, reporting names exported again for a
 * different type.
 */
export function registerTypeNames(
  registrations: Iterable<TypeNameRegistration>,
): TypeNameCollectionResult {
  const typeNames = new Set<string>();
  const typeSymbols = new Map<string, SymbolKey>();
  const underlyingSymbolToTypeName = new Map<SymbolKey, string>();
  const diagnostics: Diagnostic[] = [];
  const firstRegistrations = new Map<string, TypeNameRegistration>();

  for (const registration of registrations) {
    const { name, location, symbolKey, underlyingSymbolKey } = registration;
    const existing = firstRegistrations.get(name);
    if (existing) {
      // Re-exports of the same type from different files are no duplicates.
      if (
        symbolKey === null ||
        existing.symbolKey === null ||
        symbolKey !== existing.symbolKey
      ) {
        diagnostics.push({
          code: "DUPLICATE_TYPE_EXPORT",
          message: `Type '${name}' is exported from multiple files. First defined at ${formatLocation(existing.location)}.`,
          severity: "error",
          location,
        });
      }
      continue;
    }
    firstRegistrations.set(name, registration);
    typeNames.add(name);
    if (symbolKey !== null) {
      typeSymbols.set(name, symbolKey);
    }
    if (underlyingSymbolKey !== null) {
      underlyingSymbolToTypeName.set(underlyingSymbolKey, name);
    }
  }

  return { typeNames, typeSymbols, underlyingSymbolToTypeName, diagnostics };
}

export interface CollectTypeNameRegistrationsParams {
  readonly program: Program;
  readonly checker: CheckerLoader;
  /** The files whose exported type names to collect, in order. */
  readonly files: ReadonlyArray<string>;
}

/**
 * Collects the type names the files export, in order.
 *
 * Handles:
 * - Direct type declarations (type, interface, enum)
 * - Named re-exports: `export type { Foo } from "..."`
 * - Wildcard re-exports: `export type * from "..."`
 */
export async function collectTypeNameRegistrations(
  params: CollectTypeNameRegistrationsParams,
): Promise<TypeNameRegistration[]> {
  const { program, checker, files } = params;
  const registrations: TypeNameRegistration[] = [];

  const register = async (
    name: string,
    location: SourceLocation,
    symbol: TsSymbol | undefined,
    underlyingSymbolKey: SymbolKey | null,
  ): Promise<void> => {
    registrations.push({
      name,
      location,
      symbolKey: symbol
        ? getSymbolIdentityKey(await resolveOriginalSymbol(symbol, checker))
        : null,
      underlyingSymbolKey,
    });
  };

  // Every file is fetched, and the symbols the walk below reads prefetched,
  // in a few batched round trips before the sequential walk.
  const loadedSourceFiles = await Promise.all(
    files.map((filePath) => program.getSourceFile(filePath)),
  );
  await prefetchTypeNameFacts(
    checker,
    loadedSourceFiles.filter((sf): sf is SourceFile => sf !== undefined),
  );

  for (const sourceFile of loadedSourceFiles) {
    if (!sourceFile) continue;

    for (const node of sourceFile.statements) {
      // Direct type declarations
      if (isTypeAliasDeclaration(node) && isExported(node)) {
        const name = node.name.getText(sourceFile);
        const location = getSourceLocationFromNode(node)!;
        const symbol = await checker.getSymbolAtLocation(node.name);
        let underlyingSymbolKey: SymbolKey | null = null;
        if (symbol) {
          // For type aliases like `type User = ExternalUser;`,
          // also track the underlying type's symbol
          const type = await checker.getTypeAtLocation(node.type);
          const typeSymbol = await checker.getSymbolOfType(type);
          if (typeSymbol) {
            underlyingSymbolKey = getSymbolIdentityKey(
              await resolveOriginalSymbol(typeSymbol, checker),
            );
          }
        }
        await register(name, location, symbol, underlyingSymbolKey);
      }
      if (isInterfaceDeclaration(node) && isExported(node)) {
        const name = node.name.getText(sourceFile);
        const location = getSourceLocationFromNode(node)!;
        const symbol = await checker.getSymbolAtLocation(node.name);
        await register(name, location, symbol, null);
      }
      if (isEnumDeclaration(node) && isExported(node)) {
        const name = node.name.getText(sourceFile);
        const location = getSourceLocationFromNode(node)!;
        const symbol = await checker.getSymbolAtLocation(node.name);
        await register(name, location, symbol, null);
      }

      // Re-exports: `export type { ... } from "..."` or `export type * from "..."`
      if (isExportDeclaration(node)) {
        if (node.isTypeOnly && node.exportClause) {
          // Declaration-level type-only named re-exports: `export type { Foo, Bar } from "..."`
          if (isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements) {
              // Use the exported name (element.name), not the property name
              const name = element.name.getText(sourceFile);
              const location = getSourceLocationFromNode(element)!;
              const symbol = await checker.getSymbolAtLocation(element.name);
              await register(name, location, symbol, null);
            }
          }
        } else if (!node.isTypeOnly && node.exportClause) {
          // Specifier-level type-only re-exports: `export { type Foo, type Bar } from "..."`
          if (isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements) {
              if (!element.isTypeOnly) continue;
              const name = element.name.getText(sourceFile);
              const location = getSourceLocationFromNode(element)!;
              const symbol = await checker.getSymbolAtLocation(element.name);
              await register(name, location, symbol, null);
            }
          }
        } else if (
          node.isTypeOnly &&
          !node.exportClause &&
          node.moduleSpecifier
        ) {
          // Wildcard re-exports: `export type * from "..."`
          const moduleSymbol = await checker.getSymbolAtLocation(
            node.moduleSpecifier,
          );
          if (moduleSymbol) {
            const exports = await checker.getExportsOfModule(moduleSymbol);
            for (const exp of exports) {
              // Check if the export is a type (not a value)
              if (isTypeExport(exp)) {
                const location = getSourceLocationFromNode(node)!;
                await register(exp.name, location, exp, null);
              }
            }
          }
        }
      }
    }
  }

  return registrations;
}

/**
 * Collects all declared type names from exported type declarations.
 *
 * Used in Phase 1 of the 2-phase type extraction process to gather
 * all schema-defined type names before processing field types.
 */
export interface CollectDeclaredTypeNamesParams {
  readonly program: Program;
  readonly checker: CheckerLoader;
  readonly sourceFiles: ReadonlyArray<string>;
}

export async function collectDeclaredTypeNames(
  params: CollectDeclaredTypeNamesParams,
): Promise<TypeNameCollectionResult> {
  const { program, checker, sourceFiles } = params;
  return registerTypeNames(
    await collectTypeNameRegistrations({
      program,
      checker,
      files: sourceFiles,
    }),
  );
}

/**
 * Collects the name of every top-level type alias, interface, and enum
 * declaration across `sourceFiles`, regardless of whether it is exported.
 *
 * Used by resolver-side type-reference validation (refactor-plan.md §6
 * Decision D6) to recognize plain, non-exported local types — e.g. a
 * `defineSubscription` payload interface — as real TypeScript declarations,
 * distinct from a genuinely unresolvable (typo'd) name, even though such
 * types are never registered as schema types nor emitted (issue #343).
 * Deliberately simpler than `collectDeclaredTypeNames`: no duplicate
 * detection, no symbol tracking, no re-export handling — just a name set for
 * membership checks.
 */
export async function collectLocalTypeDeclarationNames(
  program: Program,
  sourceFiles: ReadonlyArray<string>,
): Promise<ReadonlySet<string>> {
  const names = new Set<string>();

  for (const filePath of sourceFiles) {
    const sourceFile = await program.getSourceFile(filePath);
    if (!sourceFile) continue;

    sourceFile.forEachChild((node) => {
      if (
        isTypeAliasDeclaration(node) ||
        isInterfaceDeclaration(node) ||
        isEnumDeclaration(node)
      ) {
        names.add(node.name.getText(sourceFile));
      }
    });
  }

  return names;
}

/**
 * Checks if a symbol represents a type export (not a value export).
 */
function isTypeExport(symbol: TsSymbol): boolean {
  const flags = symbol.flags;
  return (
    (flags & SymbolFlags.Type) !== 0 ||
    (flags & SymbolFlags.TypeAlias) !== 0 ||
    (flags & SymbolFlags.Interface) !== 0 ||
    (flags & SymbolFlags.Enum) !== 0
  );
}
