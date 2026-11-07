import {
  type Declaration,
  getCombinedModifierFlags,
  ModifierFlags,
  type Node,
  SyntaxKind,
  type TypeNode,
  type UnionTypeNode,
} from "typescript/ast";
import {
  isIdentifier,
  isLiteralTypeNode,
  isQualifiedName,
  isTypeReferenceNode,
} from "typescript/ast/is";
import {
  SymbolFlags,
  type Symbol as TsSymbol,
  type Type,
  TypeFlags,
} from "typescript/async";
import type { CheckerLoader } from "./checker-loader.js";

/**
 * Extracts type name from a TypeNode.
 * Handles both simple identifiers and qualified names.
 */
export function getTypeNameFromNode(typeNode: TypeNode): string | null {
  if (isTypeReferenceNode(typeNode)) {
    if (isIdentifier(typeNode.typeName)) {
      return typeNode.typeName.text;
    }
    if (isQualifiedName(typeNode.typeName)) {
      return typeNode.typeName.right.text;
    }
  }
  return null;
}

/**
 * Checks if a type represents null or undefined.
 */
export function isNullOrUndefined(type: Type): boolean {
  return (
    (type.flags & TypeFlags.Null) !== 0 ||
    (type.flags & TypeFlags.Undefined) !== 0
  );
}

/**
 * Checks if a TypeNode represents null (literal null type).
 */
function isNullTypeNode(typeNode: TypeNode): boolean {
  return (
    isLiteralTypeNode(typeNode) &&
    typeNode.literal.kind === SyntaxKind.NullKeyword
  );
}

/**
 * Filters non-null type nodes from a union type node.
 */
export function filterNonNullTypeNodes(typeNode: UnionTypeNode): TypeNode[] {
  return typeNode.types.filter((t) => !isNullTypeNode(t));
}

/**
 * Finds the first non-null type node from a union type node.
 */
export function findNonNullTypeNode(
  typeNode: UnionTypeNode,
): TypeNode | undefined {
  return filterNonNullTypeNodes(typeNode)[0];
}

/**
 * Parameters for {@link findMetadataProperty}.
 */
export interface FindMetadataPropertyParams {
  readonly type: Type;
  readonly checker: CheckerLoader;
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
export async function findMetadataProperty(
  params: FindMetadataPropertyParams,
): Promise<TsSymbol | undefined> {
  const { type, checker, propertyNames, recurseUnion } = params;

  for (const name of propertyNames) {
    const prop = await checker.getPropertyOfType(type, name);
    if (prop) {
      return prop;
    }
  }

  if (type.isIntersectionType()) {
    for (const member of await checker.getTypesOfType(type)) {
      for (const name of propertyNames) {
        const memberProp = await checker.getPropertyOfType(member, name);
        if (memberProp) {
          return memberProp;
        }
      }
    }
  }

  if (recurseUnion && type.isUnionType()) {
    for (const member of await checker.getTypesOfType(type)) {
      if (isNullOrUndefined(member)) {
        continue;
      }
      const result = await findMetadataProperty({
        checker,
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
export async function isNullableUnion(
  type: Type,
  checker: CheckerLoader,
): Promise<boolean> {
  if (!type.isUnionType()) return false;
  return (await checker.getTypesOfType(type)).some((t) => isNullOrUndefined(t));
}

/**
 * Gets non-nullable types from a union type.
 */
export async function getNonNullableTypes(
  type: Type,
  checker: CheckerLoader,
): Promise<Type[]> {
  if (!type.isUnionType()) return [type];
  return (await checker.getTypesOfType(type)).filter(
    (t) => !isNullOrUndefined(t),
  );
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
export async function hasUndefinedInType(
  type: Type,
  checker: CheckerLoader,
): Promise<boolean> {
  if ((type.flags & TypeFlags.Undefined) !== 0) return true;
  if (type.isUnionType()) {
    return (await checker.getTypesOfType(type)).some(
      (t) => (t.flags & TypeFlags.Undefined) !== 0,
    );
  }
  return false;
}

/**
 * Checks if a node has the export modifier.
 */
export function isExported(node: Node): boolean {
  const modifiers = getCombinedModifierFlags(node as Declaration);
  return (modifiers & ModifierFlags.Export) !== 0;
}

/**
 * Checks if a type is an anonymous object type (like inline type literals).
 * Named types and type aliases are not considered anonymous.
 * This is used to determine if an intersection member should trigger
 * treating the whole intersection as an inline object.
 */
export async function isAnonymousObjectType(
  type: Type,
  checker: CheckerLoader,
): Promise<boolean> {
  if (await checker.getAliasSymbolOfType(type)) {
    return false;
  }
  const symbol = await checker.getSymbolOfType(type);
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
export async function extractPropertySymbols(
  type: Type,
  checker: CheckerLoader,
): Promise<TsSymbol[]> {
  if (type.isIntersectionType()) {
    const allProps = new Map<string, TsSymbol>();
    for (const member of await checker.getTypesOfType(type)) {
      const memberProps = await checker.getPropertiesOfType(member);
      for (const prop of memberProps) {
        const propName = prop.name;
        if (!allProps.has(propName)) {
          allProps.set(propName, prop);
        }
      }
    }
    return [...allProps.values()];
  }

  const properties = await checker.getPropertiesOfType(type);
  if (properties.length > 0) {
    return [...properties];
  }

  const apparentType = await checker.getApparentType(type);
  if (apparentType !== type) {
    return [...(await checker.getPropertiesOfType(apparentType))];
  }

  return [];
}

async function getParentOfTypeSymbol(
  type: Type,
  checker: CheckerLoader,
): Promise<TsSymbol | undefined> {
  const symbol = await checker.getSymbolOfType(type);
  return symbol ? checker.getParentOfSymbol(symbol) : undefined;
}

/**
 * Finds the parent enum symbol if all types belong to the same enum.
 * Returns null if types are empty, don't have a common parent enum, or belong to different enums.
 */
export async function findEnumParentSymbol(
  types: readonly Type[],
  checker: CheckerLoader,
): Promise<TsSymbol | null> {
  if (types.length === 0) return null;

  const parentSymbol = await getParentOfTypeSymbol(types[0]!, checker);

  if (!parentSymbol || !(parentSymbol.flags & SymbolFlags.Enum)) {
    return null;
  }

  const parents = await Promise.all(
    types.map((t) => getParentOfTypeSymbol(t, checker)),
  );
  const allBelongToSameEnum = parents.every((p) => p === parentSymbol);

  return allBelongToSameEnum ? parentSymbol : null;
}

/**
 * Checks if a union type is a boolean union (true | false with optional null/undefined).
 */
export async function isBooleanUnion(
  type: Type,
  checker: CheckerLoader,
): Promise<boolean> {
  if (!type.isUnionType()) return false;
  const nonNullTypes = await getNonNullableTypes(type, checker);
  return (
    nonNullTypes.length === 2 &&
    nonNullTypes.every((t) => t.flags & TypeFlags.BooleanLiteral)
  );
}

/**
 * Resolves a symbol to its original symbol by following alias chains.
 * This is necessary for re-exports where the symbol is an alias.
 */
export async function resolveOriginalSymbol(
  symbol: TsSymbol,
  checker: CheckerLoader,
): Promise<TsSymbol> {
  if (symbol.flags & SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
}
