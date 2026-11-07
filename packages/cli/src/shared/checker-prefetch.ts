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

import { METADATA_PROPERTIES } from "../core/index.js";
import * as ts from "../core/typescript.js";
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

function isUnionOrIntersection(type: ts.Type): boolean {
  return (type.flags & ts.TypeFlags.UnionOrIntersection) !== 0;
}

function isObjectType(type: ts.Type): boolean {
  return (type.flags & ts.TypeFlags.Object) !== 0;
}

function isTypeReference(type: ts.Type): boolean {
  return (
    (type.flags & ts.TypeFlags.Object) !== 0 &&
    ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) !== 0
  );
}

function isLiteralType(type: ts.Type): boolean {
  return (
    (type.flags & (ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral)) !==
    0
  );
}

function hasIndexableShape(type: ts.Type): boolean {
  return (
    (type.flags & ts.TypeFlags.Object) !== 0 &&
    ((type as ts.ObjectType).objectFlags &
      (ts.ObjectFlags.Anonymous | ts.ObjectFlags.Mapped)) !==
      0
  );
}

/**
 * Whether a nested type is worth visiting: object types and
 * unions/intersections carry metadata and members, and literals are read
 * through their display strings. Other primitives are classified from their
 * flags alone.
 */
function isVisitedType(type: ts.Type): boolean {
  return (
    (type.flags & (ts.TypeFlags.Object | ts.TypeFlags.UnionOrIntersection)) !==
      0 || isLiteralType(type)
  );
}

/**
 * Whether a type is written as a type literal (`{ ... }`). Field-type
 * resolution walks such types' properties as inline objects, and their
 * property lists are as long as what is written there.
 */
function isTypeLiteral(
  type: ts.Type,
  symbol: ts.Symbol | undefined,
  aliasSymbol: ts.Symbol | undefined,
): boolean {
  return (
    (type.flags & ts.TypeFlags.Object) !== 0 &&
    ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Anonymous) !== 0 &&
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
  type: ts.Type,
): Promise<ReadonlyArray<ts.Type>> {
  const [members, isArray, typeArguments, symbol, aliasSymbol] =
    await Promise.all([
      isUnionOrIntersection(type)
        ? checker.getTypesOfType(type as ts.UnionOrIntersectionType)
        : [],
      checker.isArrayType(type),
      isTypeReference(type)
        ? checker.getTypeArguments(type as ts.TypeReference)
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
  types: ReadonlyArray<ts.Type>,
): Promise<void> {
  const seen = new Set<ts.Type>();
  // Each type is followed on its own; queries issued in the same tick still
  // travel together, and no type waits for slower siblings before descending.
  const visit = async (type: ts.Type, depth: number): Promise<void> => {
    if (seen.has(type)) {
      return;
    }
    seen.add(type);
    const nested = await prefetchFactsOfType(checker, type);
    if (depth < NESTED_TYPE_DEPTH) {
      await Promise.all(
        nested.filter(isVisitedType).map((t) => visit(t, depth + 1)),
      );
    }
  };
  await Promise.all(types.map((type) => visit(type, 0)));
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
  properties: ReadonlyArray<ts.Symbol>,
): Promise<void> {
  const unique = [...new Set(properties)];
  const [types] = await Promise.all([
    Promise.all(unique.map((p) => checker.getTypeOfSymbol(p))),
    Promise.all(unique.map((p) => checker.getDocumentationComment(p))),
  ]);
  await prefetchTypeFacts(checker, types);
}

/** Walks syntax (already local, no request) for names in type references. */
function collectReferenceNames(nodes: ReadonlyArray<ts.Node>): ts.EntityName[] {
  const names: ts.EntityName[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTypeReferenceNode(node)) {
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
  names: ReadonlyArray<ts.EntityName>,
): Promise<void> {
  const symbols = await Promise.all(
    names.map((n) => checker.getSymbolAtLocation(n)),
  );
  await Promise.all(
    symbols.flatMap((s) =>
      s !== undefined && (s.flags & ts.SymbolFlags.Alias) !== 0
        ? [checker.getAliasedSymbol(s)]
        : [],
    ),
  );
}

type NamedDeclaration =
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.EnumDeclaration;

function isNamedTypeDeclaration(node: ts.Node): node is NamedDeclaration {
  return (
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node)
  );
}

/** Members of type aliases' top-level unions, named union members. */
function collectUnionMembers(
  declarations: ReadonlyArray<NamedDeclaration>,
): ts.TypeNode[] {
  return declarations.flatMap((d) =>
    ts.isTypeAliasDeclaration(d) && ts.isUnionTypeNode(d.type)
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
  const declared = symbols.filter((s): s is ts.Symbol => s !== undefined);
  const [types] = await Promise.all([
    Promise.all(declared.map((s) => checker.getDeclaredTypeOfSymbol(s))),
    Promise.all(declared.map((s) => checker.getDocumentationComment(s))),
    Promise.all(
      declarations.flatMap((d) =>
        ts.isTypeAliasDeclaration(d) ? [checker.getTypeAtLocation(d.type)] : [],
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
  type: ts.Type,
): Promise<ReadonlyArray<ts.Symbol>> {
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

/**
 * Prefetches, for every type declaration in the files, its declared type and
 * the facts about it and its properties, the symbols its type references
 * name and its union members' types. Covers the first levels every
 * extraction stage reads.
 */
export async function prefetchDeclarationFacts(
  checker: CheckerLoader,
  sourceFiles: ReadonlyArray<ts.SourceFile>,
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
