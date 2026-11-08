/**
 * Warms the checker loader before a stage walks many declarations or
 * properties one at a time.
 *
 * The extraction logic stays sequential on purpose: shared state such as
 * the discovered-type registry decides what later declarations produce, so
 * running them concurrently would make the output depend on timing. Instead,
 * the facts each step will read are requested up front, all at once, so they
 * travel in a handful of batched round trips and the sequential pass is
 * answered from the loader's cache. Correctness never depends on what is
 * prefetched here; a fact missing from this list only costs a round trip.
 */

import type {
  EntityName,
  EnumDeclaration,
  InterfaceDeclaration,
  Node,
  SourceFile,
  TypeAliasDeclaration,
  TypeNode,
} from "typescript/ast";
import {
  isEnumDeclaration,
  isExportDeclaration,
  isInterfaceDeclaration,
  isNamedExports,
  isTypeAliasDeclaration,
  isTypeReferenceNode,
  isUnionTypeNode,
} from "typescript/ast/is";
import {
  ObjectFlags,
  type ObjectType,
  SymbolFlags,
  type Symbol as TsSymbol,
  type Type,
  TypeFlags,
  type TypeReference,
  type UnionOrIntersectionType,
} from "typescript/async";
import { METADATA_PROPERTIES } from "../core/index.js";
import type { CheckerLoader } from "./checker-loader.js";

/**
 * Metadata keys looked up on nearly every declared or field type (field and
 * type wrappers, the original-type marker, scalars, interfaces).
 */
const COMMON_METADATA_NAMES: ReadonlyArray<string> = [
  METADATA_PROPERTIES.FIELD_META,
  METADATA_PROPERTIES.TYPE_META,
  METADATA_PROPERTIES.ORIGINAL_TYPE,
  METADATA_PROPERTIES.SCALAR,
  METADATA_PROPERTIES.INTERFACE_META,
];

/**
 * How many levels of union/intersection members, array elements and type
 * literal properties below the given types to prefetch. The detectors and
 * field-type resolution walk into these one member at a time; prefetching
 * them costs a round trip per level for all types together instead of one
 * per member.
 */
const NESTED_TYPE_DEPTH = 3;

function isUnionOrIntersection(type: Type): boolean {
  return (type.flags & TypeFlags.UnionOrIntersection) !== 0;
}

function isObjectType(type: Type): boolean {
  return (type.flags & TypeFlags.Object) !== 0;
}

function isTypeReference(type: Type): boolean {
  return (
    (type.flags & TypeFlags.Object) !== 0 &&
    ((type as ObjectType).objectFlags & ObjectFlags.Reference) !== 0
  );
}

function isLiteralType(type: Type): boolean {
  return (
    (type.flags & (TypeFlags.StringLiteral | TypeFlags.NumberLiteral)) !== 0
  );
}

function hasIndexableShape(type: Type): boolean {
  return (
    (type.flags & TypeFlags.Object) !== 0 &&
    ((type as ObjectType).objectFlags &
      (ObjectFlags.Anonymous | ObjectFlags.Mapped)) !==
      0
  );
}

/**
 * Whether a nested type is worth visiting: object types and
 * unions/intersections carry metadata and members, and literals are read
 * through their display strings. Other primitives are classified from their
 * flags alone.
 */
function isVisitedType(type: Type): boolean {
  return (
    (type.flags & (TypeFlags.Object | TypeFlags.UnionOrIntersection)) !== 0 ||
    isLiteralType(type)
  );
}

/**
 * Whether a type is written as a type literal (`{ ... }`). Field-type
 * resolution walks such types' properties as inline objects, and their
 * property lists are as long as what is written there.
 */
function isTypeLiteral(
  type: Type,
  symbol: TsSymbol | undefined,
  aliasSymbol: TsSymbol | undefined,
): boolean {
  return (
    (type.flags & TypeFlags.Object) !== 0 &&
    ((type as ObjectType).objectFlags & ObjectFlags.Anonymous) !== 0 &&
    aliasSymbol === undefined &&
    symbol?.name === "__type"
  );
}

/**
 * Prefetches the facts of one type and returns the types nested in it:
 * members, array elements and the property types of type literals.
 */
async function prefetchFactsOfType(
  checker: CheckerLoader,
  type: Type,
): Promise<ReadonlyArray<Type>> {
  const [members, isArray, typeArguments, symbol, aliasSymbol] =
    await Promise.all([
      isUnionOrIntersection(type)
        ? checker.getTypesOfType(type as UnionOrIntersectionType)
        : [],
      checker.isArrayType(type),
      isTypeReference(type)
        ? checker.getTypeArguments(type as TypeReference)
        : [],
      checker.getSymbolOfType(type),
      checker.getAliasSymbolOfType(type),
      checker.isTupleType(type),
      ...COMMON_METADATA_NAMES.map((name) =>
        checker.getPropertyOfType(type, name),
      ),
      // Literal values are converted from their display strings; record-like
      // object types are recognized by their string index.
      isLiteralType(type) ? checker.typeToString(type) : undefined,
      hasIndexableShape(type)
        ? checker.getStringIndexTypeOfType(type)
        : undefined,
    ]);
  const nested = isArray ? [...members, ...typeArguments.slice(0, 1)] : members;
  if (!isTypeLiteral(type, symbol, aliasSymbol)) {
    return nested;
  }
  const properties = await checker.getPropertiesOfType(type);
  const [propertyTypes] = await Promise.all([
    Promise.all(properties.map((p) => checker.getTypeOfSymbol(p))),
    Promise.all(properties.map((p) => checker.getDocumentationComment(p))),
  ]);
  return [...nested, ...propertyTypes];
}

/**
 * Prefetches what field-type resolution and the metadata detectors read
 * about each type and the types nested in it: symbols, array/tuple-ness,
 * union or intersection members, array elements, gqlkit metadata keys,
 * literals' display strings, string index types and the properties of type
 * literals. Facts whose size grows with a named type (its property list, its
 * display string) are left to the code that needs them, since external types
 * can be huge.
 */
async function prefetchTypeFacts(
  checker: CheckerLoader,
  types: ReadonlyArray<Type>,
): Promise<void> {
  const covered = coveredLevelsOf(checker);
  // Each type is followed on its own; queries issued in the same tick still
  // travel together, and no type waits for slower siblings before descending.
  const visit = async (type: Type, levelsBelow: number): Promise<void> => {
    if ((covered.get(type) ?? -1) >= levelsBelow) {
      return;
    }
    covered.set(type, levelsBelow);
    const nested = await prefetchFactsOfType(checker, type);
    if (levelsBelow > 0) {
      await Promise.all(
        nested.filter(isVisitedType).map((t) => visit(t, levelsBelow - 1)),
      );
    }
  };
  await Promise.all(types.map((type) => visit(type, NESTED_TYPE_DEPTH)));
}

/**
 * How many levels below each type a loader's prefetches have covered.
 * Successive walks prefetch overlapping types, and following them again only
 * to find every fact cached costs client time at scale; a type covered to at
 * least the depth asked for is skipped. Its facts may still be in flight,
 * which is harmless: the loader shares in-flight queries.
 */
const coveredLevels = new WeakMap<CheckerLoader, WeakMap<Type, number>>();

function coveredLevelsOf(checker: CheckerLoader): WeakMap<Type, number> {
  let covered = coveredLevels.get(checker);
  if (covered === undefined) {
    covered = new WeakMap();
    coveredLevels.set(checker, covered);
  }
  return covered;
}

/**
 * Prefetches each property's type and documentation, then the facts about
 * those types. Property declarations are deliberately not resolved here:
 * resolving one fetches its whole source file, which for properties of
 * generated ORM or lib types is a multi-megabyte `.d.ts` the extraction
 * itself never reads.
 */
export async function prefetchPropertyFacts(
  checker: CheckerLoader,
  properties: ReadonlyArray<TsSymbol>,
): Promise<void> {
  const unique = [...new Set(properties)];
  const [types] = await Promise.all([
    Promise.all(unique.map((p) => checker.getTypeOfSymbol(p))),
    Promise.all(unique.map((p) => checker.getDocumentationComment(p))),
  ]);
  await prefetchTypeFacts(checker, types);
}

/** Walks syntax (already local, no request) for names in type references. */
function collectReferenceNames(nodes: ReadonlyArray<Node>): EntityName[] {
  const names: EntityName[] = [];
  const visit = (node: Node): void => {
    if (isTypeReferenceNode(node)) {
      names.push(node.typeName);
    }
    node.forEachChild(visit);
  };
  for (const node of nodes) {
    visit(node);
  }
  return names;
}

/**
 * Prefetches the symbols type references name, through import aliases:
 * field-type resolution matches references to known types by symbol.
 */
async function prefetchReferencedSymbols(
  checker: CheckerLoader,
  names: ReadonlyArray<EntityName>,
): Promise<void> {
  const symbols = await Promise.all(
    names.map((n) => checker.getSymbolAtLocation(n)),
  );
  await prefetchAliasTargets(checker, symbols);
}

type NamedDeclaration =
  | InterfaceDeclaration
  | TypeAliasDeclaration
  | EnumDeclaration;

function isNamedTypeDeclaration(node: Node): node is NamedDeclaration {
  return (
    isInterfaceDeclaration(node) ||
    isTypeAliasDeclaration(node) ||
    isEnumDeclaration(node)
  );
}

/** Members of type aliases' top-level unions, named union members. */
function collectUnionMembers(
  declarations: ReadonlyArray<NamedDeclaration>,
): TypeNode[] {
  return declarations.flatMap((d) =>
    isTypeAliasDeclaration(d) && isUnionTypeNode(d.type)
      ? [...d.type.types]
      : [],
  );
}

/**
 * Prefetches each declaration's symbol, declared type, documentation and the
 * type of its annotation, then the facts about those types and their
 * properties.
 */
async function prefetchDeclaredTypes(
  checker: CheckerLoader,
  declarations: ReadonlyArray<NamedDeclaration>,
): Promise<void> {
  const symbols = await Promise.all(
    declarations.map((d) => checker.getSymbolAtLocation(d.name)),
  );
  const declared = symbols.filter((s): s is TsSymbol => s !== undefined);
  const [types] = await Promise.all([
    Promise.all(declared.map((s) => checker.getDeclaredTypeOfSymbol(s))),
    Promise.all(declared.map((s) => checker.getDocumentationComment(s))),
    Promise.all(
      declarations.flatMap((d) =>
        isTypeAliasDeclaration(d) ? [checker.getTypeAtLocation(d.type)] : [],
      ),
    ),
  ]);
  const [properties] = await Promise.all([
    Promise.all(types.map((t) => listWalkedProperties(checker, t))),
    prefetchTypeFacts(checker, types),
  ]);
  await prefetchPropertyFacts(checker, properties.flat());
}

/**
 * Lists the properties field extraction will walk for a declared type: an
 * object type's own, or those of an intersection's object members (see
 * `extractPropertySymbols`). Unions and primitives are skipped: their
 * property lists are their apparent type's members (e.g. all of `String`'s
 * for a union of string literals), which no stage reads and which are large.
 */
async function listWalkedProperties(
  checker: CheckerLoader,
  type: Type,
): Promise<ReadonlyArray<TsSymbol>> {
  if (isObjectType(type)) {
    return checker.getPropertiesOfType(type);
  }
  if (!type.isIntersectionType()) {
    return [];
  }
  const members = await checker.getTypesOfType(type);
  const lists = await Promise.all(
    members.filter(isObjectType).map((m) => checker.getPropertiesOfType(m)),
  );
  return lists.flat();
}

/** Resolves symbols that are import or export aliases to their targets. */
async function prefetchAliasTargets(
  checker: CheckerLoader,
  symbols: ReadonlyArray<TsSymbol | undefined>,
): Promise<void> {
  await Promise.all(
    symbols.flatMap((s) =>
      s !== undefined && (s.flags & SymbolFlags.Alias) !== 0
        ? [checker.getAliasedSymbol(s)]
        : [],
    ),
  );
}

/**
 * Prefetches what collecting the declared type names reads: the symbols of
 * type declarations and re-exported names, through aliases, and the symbols
 * of the types that type aliases name.
 */
export async function prefetchTypeNameFacts(
  checker: CheckerLoader,
  sourceFiles: ReadonlyArray<SourceFile>,
): Promise<void> {
  const statements = sourceFiles.flatMap((sf) => sf.statements);
  const declarations = statements.filter(isNamedTypeDeclaration);
  const exportedNames = statements.flatMap((node) =>
    isExportDeclaration(node) &&
    node.exportClause !== undefined &&
    isNamedExports(node.exportClause)
      ? node.exportClause.elements.map((e) => e.name)
      : [],
  );
  const aliasTypeSymbols = async (): Promise<void> => {
    const types = await Promise.all(
      declarations.flatMap((d) =>
        isTypeAliasDeclaration(d) ? [checker.getTypeAtLocation(d.type)] : [],
      ),
    );
    await prefetchAliasTargets(
      checker,
      await Promise.all(types.map((t) => checker.getSymbolOfType(t))),
    );
  };
  await Promise.all([
    Promise.all(
      [...declarations.map((d) => d.name), ...exportedNames].map((n) =>
        checker.getSymbolAtLocation(n),
      ),
    ).then((symbols) => prefetchAliasTargets(checker, symbols)),
    aliasTypeSymbols(),
  ]);
}

/**
 * Prefetches, for every type declaration in the files, its declared type and
 * the facts about it and its properties, the symbols its type references
 * name and its union members' types. Covers the first levels every
 * extraction stage reads.
 */
export async function prefetchDeclarationFacts(
  checker: CheckerLoader,
  sourceFiles: ReadonlyArray<SourceFile>,
): Promise<void> {
  const declarations = sourceFiles.flatMap((sf) =>
    sf.statements.filter(isNamedTypeDeclaration),
  );
  await Promise.all([
    prefetchDeclaredTypes(checker, declarations),
    prefetchReferencedSymbols(checker, collectReferenceNames(declarations)),
    Promise.all(
      collectUnionMembers(declarations).map((n) =>
        checker.getTypeFromTypeNode(n),
      ),
    ),
  ]);
}
