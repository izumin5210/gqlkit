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
 * How many levels of union/intersection members and array elements below
 * the given types to prefetch. The detectors and field-type resolution walk
 * into these one member at a time; each level costs one batched round trip
 * here instead of one round trip per member there.
 */
const NESTED_TYPE_DEPTH = 3;

function isUnionOrIntersection(type: ts.Type): boolean {
  return (type.flags & ts.TypeFlags.UnionOrIntersection) !== 0;
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

/** Prefetches the facts of one type and returns its members and elements. */
async function prefetchFactsOfType(
  checker: CheckerLoader,
  type: ts.Type,
): Promise<ReadonlyArray<ts.Type>> {
  const [members, isArray, typeArguments] = await Promise.all([
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
  return isArray ? [...members, ...typeArguments.slice(0, 1)] : members;
}

/**
 * Prefetches what field-type resolution and the metadata detectors read
 * about each type and the types nested in it: symbols, array/tuple-ness,
 * union or intersection members, array elements, gqlkit metadata keys,
 * literals' display strings and string index types. Facts whose size grows
 * with the type (its full property list, the display string of anything but
 * a literal) are left to the code that needs them, since external types can
 * be huge.
 */
async function prefetchTypeFacts(
  checker: CheckerLoader,
  types: ReadonlyArray<ts.Type>,
): Promise<void> {
  const seen = new Set(types);
  let level = [...seen];
  for (let depth = 0; depth <= NESTED_TYPE_DEPTH && level.length > 0; depth++) {
    const nested = await Promise.all(
      level.map((type) => prefetchFactsOfType(checker, type)),
    );
    level = [...new Set(nested.flat())].filter(
      (type) => isVisitedType(type) && !seen.has(type),
    );
    for (const type of level) {
      seen.add(type);
    }
  }
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

interface TypeNodeReferences {
  /** Names in type references, whose symbols resolve references by name. */
  readonly referenceNames: ts.EntityName[];
  /** Members of a type alias's top-level union, named union members. */
  readonly unionMembers: ts.TypeNode[];
}

/** Walks declarations' syntax (already local, no request) for type nodes. */
function collectTypeNodeReferences(
  declarations: ReadonlyArray<NamedDeclaration>,
): TypeNodeReferences {
  const referenceNames: ts.EntityName[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTypeReferenceNode(node)) {
      referenceNames.push(node.typeName);
    }
    node.forEachChild(visit);
  };
  const unionMembers: ts.TypeNode[] = [];
  for (const declaration of declarations) {
    visit(declaration);
    if (
      ts.isTypeAliasDeclaration(declaration) &&
      ts.isUnionTypeNode(declaration.type)
    ) {
      unionMembers.push(...declaration.type.types);
    }
  }
  return { referenceNames, unionMembers };
}

/**
 * Prefetches, for every type declaration in the files, its symbol, declared
 * type, documentation and the type of its annotation, the symbols its type
 * references name and its union members' types, then the facts about its
 * properties. Covers the first levels every extraction stage reads.
 */
export async function prefetchDeclarationFacts(
  checker: CheckerLoader,
  sourceFiles: ReadonlyArray<ts.SourceFile>,
): Promise<void> {
  const declarations = sourceFiles.flatMap((sf) =>
    sf.statements.filter(isNamedTypeDeclaration),
  );
  const { referenceNames, unionMembers } =
    collectTypeNodeReferences(declarations);
  const [symbols] = await Promise.all([
    Promise.all(declarations.map((d) => checker.getSymbolAtLocation(d.name))),
    Promise.all(referenceNames.map((n) => checker.getSymbolAtLocation(n))),
    Promise.all(unionMembers.map((n) => checker.getTypeFromTypeNode(n))),
  ]);
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
    Promise.all(types.map((t) => checker.getPropertiesOfType(t))),
    prefetchTypeFacts(checker, types),
  ]);
  await prefetchPropertyFacts(checker, properties.flat());
}
