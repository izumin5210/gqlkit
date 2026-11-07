import * as ts from "../core/typescript.js";

/**
 * Extracts type name from a TypeNode.
 * Handles both simple identifiers and qualified names.
 */
export function getTypeNameFromNode(typeNode: ts.TypeNode): string | null {
  if (ts.isTypeReferenceNode(typeNode)) {
    if (ts.isIdentifier(typeNode.typeName)) {
      return typeNode.typeName.text;
    }
    if (ts.isQualifiedName(typeNode.typeName)) {
      return typeNode.typeName.right.text;
    }
  }
  return null;
}

/**
 * Resolves a symbol's declaration handles into AST nodes.
 */
export function getDeclarations(
  symbol: ts.Symbol,
): ReadonlyArray<ts.Declaration> {
  return symbol.declarations.flatMap((handle) => handle.resolve() ?? []);
}

const propertiesByName = new WeakMap<ts.Type, Map<string, ts.Symbol>>();
const primitivePropertyLookups = new WeakMap<
  ts.Type,
  Map<string, ts.Symbol | undefined>
>();

/**
 * Looks up a property by name with as few round trips to the tsc process as
 * possible; `type.getProperty()` would issue one on every call.
 *
 * - Non-primitive types: the API client fetches the property list once and
 *   caches it on the type object. Unlike the checker's own lookup, this does
 *   not fall back to `Object`/`Function` prototype members, which none of
 *   gqlkit's lookups rely on.
 * - Primitive types: their apparent type is a lib interface (`String` has
 *   ~50 members), whose full list costs ~20x a single-name lookup, so each
 *   name is asked once and memoized.
 */
export function getPropertyByName(
  type: ts.Type,
  name: string,
): ts.Symbol | undefined {
  if (type.flags & ts.TypeFlags.Primitive) {
    let lookups = primitivePropertyLookups.get(type);
    if (lookups === undefined) {
      lookups = new Map();
      primitivePropertyLookups.set(type, lookups);
    }
    if (!lookups.has(name)) {
      lookups.set(name, type.getProperty(name));
    }
    return lookups.get(name);
  }

  let byName = propertiesByName.get(type);
  if (byName === undefined) {
    byName = new Map(type.getProperties().map((p) => [p.name, p]));
    propertiesByName.set(type, byName);
  }
  return byName.get(name);
}

/**
 * Checks if a type represents null or undefined.
 */
export function isNullOrUndefined(type: ts.Type): boolean {
  return (
    (type.flags & ts.TypeFlags.Null) !== 0 ||
    (type.flags & ts.TypeFlags.Undefined) !== 0
  );
}

/**
 * Checks if a TypeNode represents null (literal null type).
 */
function isNullTypeNode(typeNode: ts.TypeNode): boolean {
  return (
    ts.isLiteralTypeNode(typeNode) &&
    typeNode.literal.kind === ts.SyntaxKind.NullKeyword
  );
}

/**
 * Filters non-null type nodes from a union type node.
 */
export function filterNonNullTypeNodes(
  typeNode: ts.UnionTypeNode,
): ts.TypeNode[] {
  return typeNode.types.filter((t) => !isNullTypeNode(t));
}

/**
 * Finds the first non-null type node from a union type node.
 */
export function findNonNullTypeNode(
  typeNode: ts.UnionTypeNode,
): ts.TypeNode | undefined {
  return filterNonNullTypeNodes(typeNode)[0];
}

/**
 * Parameters for {@link findMetadataProperty}.
 */
export interface FindMetadataPropertyParams {
  readonly type: ts.Type;
  readonly propertyNames: ReadonlyArray<string>;
  readonly recurseUnion: boolean;
}

/**
 * Finds a metadata property symbol on a type by walking the "own property ->
 * each intersection member -> non-null union members" shape shared by
 * gqlkit's metadata detectors (field meta, type meta, interface meta, etc).
 *
 * At each tier, `propertyNames` are tried in order and the first match wins.
 * This reproduces call sites that fall back between multiple marker property
 * names (e.g. field-meta or type-meta) without changing tier-priority: every
 * name is checked against the current tier before moving to the next tier.
 *
 * Set `recurseUnion` to `false` to reproduce call sites that never handle
 * union types (own + intersection tiers only).
 */
export function findMetadataProperty(
  params: FindMetadataPropertyParams,
): ts.Symbol | undefined {
  const { type, propertyNames, recurseUnion } = params;

  for (const name of propertyNames) {
    const prop = getPropertyByName(type, name);
    if (prop) {
      return prop;
    }
  }

  if (type.isIntersectionType()) {
    for (const member of type.getTypes()) {
      for (const name of propertyNames) {
        const memberProp = getPropertyByName(member, name);
        if (memberProp) {
          return memberProp;
        }
      }
    }
  }

  if (recurseUnion && type.isUnionType()) {
    for (const member of type.getTypes()) {
      if (isNullOrUndefined(member)) {
        continue;
      }
      const result = findMetadataProperty({
        type: member,
        propertyNames,
        recurseUnion,
      });
      if (result) {
        return result;
      }
    }
  }

  return undefined;
}

/**
 * Checks if a union type contains null or undefined.
 */
export function isNullableUnion(type: ts.Type): boolean {
  if (!type.isUnionType()) return false;
  return type.getTypes().some((t) => isNullOrUndefined(t));
}

/**
 * Gets non-nullable types from a union type.
 */
export function getNonNullableTypes(type: ts.Type): ts.Type[] {
  if (!type.isUnionType()) return [type];
  return type.getTypes().filter((t) => !isNullOrUndefined(t));
}

/**
 * Checks if a type contains undefined.
 * This is used to determine property optionality from resolved types,
 * which correctly handles utility types like Required<T> and Partial<T>.
 *
 * In TypeScript:
 * - Optional properties (?) add undefined to the type
 * - Partial<T> adds undefined to all property types
 * - Required<T> removes undefined from all property types
 */
export function hasUndefinedInType(type: ts.Type): boolean {
  if ((type.flags & ts.TypeFlags.Undefined) !== 0) return true;
  if (type.isUnionType()) {
    return type
      .getTypes()
      .some((t) => (t.flags & ts.TypeFlags.Undefined) !== 0);
  }
  return false;
}

/**
 * Checks if a node has the export modifier.
 */
export function isExported(node: ts.Node): boolean {
  const modifiers = ts.getCombinedModifierFlags(node as ts.Declaration);
  return (modifiers & ts.ModifierFlags.Export) !== 0;
}

/**
 * Checks if a type is an anonymous object type (like inline type literals).
 * Named types and type aliases are not considered anonymous.
 * This is used to determine if an intersection member should trigger
 * treating the whole intersection as an inline object.
 */
export function isAnonymousObjectType(type: ts.Type): boolean {
  if (type.getAliasSymbol()) {
    return false;
  }
  const symbol = type.getSymbol();
  if (!symbol) {
    return true;
  }
  const symbolName = symbol.name;
  return symbolName === "__type" || symbolName === "";
}

/**
 * Extracts property symbols from a type, handling intersection types
 * and falling back to getApparentType when getProperties() returns empty.
 */
export function extractPropertySymbols(
  type: ts.Type,
  checker: ts.Checker,
): ts.Symbol[] {
  if (type.isIntersectionType()) {
    const allProps = new Map<string, ts.Symbol>();
    for (const member of type.getTypes()) {
      const memberProps = member.getProperties();
      for (const prop of memberProps) {
        const propName = prop.name;
        if (!allProps.has(propName)) {
          allProps.set(propName, prop);
        }
      }
    }
    return [...allProps.values()];
  }

  const properties = type.getProperties();
  if (properties.length > 0) {
    return [...properties];
  }

  const apparentType = checker.getApparentType(type);
  if (apparentType !== type) {
    return [...apparentType.getProperties()];
  }

  return [];
}

/**
 * Finds the parent enum symbol if all types belong to the same enum.
 * Returns null if types are empty, don't have a common parent enum, or belong to different enums.
 */
export function findEnumParentSymbol(
  types: readonly ts.Type[],
): ts.Symbol | null {
  if (types.length === 0) return null;

  const parentSymbol = types[0]!.getSymbol()?.getParent();

  if (!parentSymbol || !(parentSymbol.flags & ts.SymbolFlags.Enum)) {
    return null;
  }

  const allBelongToSameEnum = types.every(
    (t) => t.getSymbol()?.getParent() === parentSymbol,
  );

  return allBelongToSameEnum ? parentSymbol : null;
}

/**
 * Checks if a union type is a boolean union (true | false with optional null/undefined).
 */
export function isBooleanUnion(type: ts.Type): boolean {
  if (!type.isUnionType()) return false;
  const nonNullTypes = getNonNullableTypes(type);
  return (
    nonNullTypes.length === 2 &&
    nonNullTypes.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)
  );
}

/**
 * Resolves a symbol to its original symbol by following alias chains.
 * This is necessary for re-exports where the symbol is an alias.
 */
export function resolveOriginalSymbol(
  symbol: ts.Symbol,
  checker: ts.Checker,
): ts.Symbol {
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
}
