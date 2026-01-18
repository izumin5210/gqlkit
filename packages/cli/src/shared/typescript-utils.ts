import ts from "typescript";
import { isInlineObjectType } from "./inline-object-utils.js";

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
 * Checks if a TypeNode represents undefined.
 */
function isUndefinedTypeNode(typeNode: ts.TypeNode): boolean {
  return typeNode.kind === ts.SyntaxKind.UndefinedKeyword;
}

export interface FilterNonNullTypeNodesOptions {
  readonly includeUndefined?: boolean;
}

/**
 * Filters non-null (and optionally non-undefined) type nodes from a union type node.
 * By default, only filters out null. Set includeUndefined to also filter out undefined.
 */
export function filterNonNullTypeNodes(
  typeNode: ts.UnionTypeNode,
  options?: FilterNonNullTypeNodesOptions,
): ts.TypeNode[] {
  const { includeUndefined = false } = options ?? {};
  return typeNode.types.filter((t) => {
    if (isNullTypeNode(t)) return false;
    if (includeUndefined && isUndefinedTypeNode(t)) return false;
    return true;
  });
}

/**
 * Finds the first non-null (and optionally non-undefined) type node from a union type node.
 * By default, only filters out null. Set includeUndefined to also filter out undefined.
 */
export function findNonNullTypeNode(
  typeNode: ts.UnionTypeNode,
  options?: FilterNonNullTypeNodesOptions,
): ts.TypeNode | undefined {
  return filterNonNullTypeNodes(typeNode, options)[0];
}

/**
 * Checks if a union type contains null or undefined.
 */
export function isNullableUnion(type: ts.Type): boolean {
  if (!type.isUnion()) return false;
  return type.types.some((t) => isNullOrUndefined(t));
}

/**
 * Gets non-nullable types from a union type.
 */
export function getNonNullableTypes(type: ts.Type): ts.Type[] {
  if (!type.isUnion()) return [type];
  return type.types.filter((t) => !isNullOrUndefined(t));
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
  if (type.isUnion()) {
    return type.types.some((t) => (t.flags & ts.TypeFlags.Undefined) !== 0);
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
  if (type.aliasSymbol) {
    return false;
  }
  if (!type.symbol) {
    return true;
  }
  const symbolName = type.symbol.getName();
  return symbolName === "__type" || symbolName === "";
}

/**
 * Checks if a type is an object-like type (interface, anonymous object, or mapped type).
 * Used to determine if an intersection of object types should be treated as inline.
 */
function isObjectLikeType(type: ts.Type): boolean {
  if (!(type.flags & ts.TypeFlags.Object)) {
    return false;
  }
  const objectType = type as ts.ObjectType;
  return (
    (objectType.objectFlags & ts.ObjectFlags.Interface) !== 0 ||
    (objectType.objectFlags & ts.ObjectFlags.Anonymous) !== 0 ||
    (objectType.objectFlags & ts.ObjectFlags.Mapped) !== 0
  );
}

/**
 * Extracts property symbols from a type, handling intersection types
 * and falling back to getApparentType when getProperties() returns empty.
 */
export function extractPropertySymbols(
  type: ts.Type,
  checker: ts.TypeChecker,
): ts.Symbol[] {
  if (type.isIntersection()) {
    const allProps = new Map<string, ts.Symbol>();
    for (const member of type.types) {
      const memberProps = member.getProperties();
      for (const prop of memberProps) {
        const propName = prop.getName();
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
 * Determines if an intersection type should be treated as an inline object.
 * Returns true when:
 * - Case 1: Has at least one anonymous/inline member
 * - Case 2: All members are object-like types that should be merged
 */
export function shouldTreatIntersectionAsInline(
  type: ts.IntersectionType,
): boolean {
  const hasResolvableMember = type.types.some(
    (t) => isInlineObjectType(t) || isAnonymousObjectType(t),
  );
  if (hasResolvableMember) {
    return true;
  }

  const allObjectLike = type.types.every((t) => isObjectLikeType(t));
  if (allObjectLike) {
    return true;
  }

  return false;
}

/**
 * Internal TypeScript symbol with parent reference.
 * Used to access the parent enum symbol from enum member types.
 */
export type SymbolWithParent = ts.Symbol & { parent?: ts.Symbol };

/**
 * Finds the parent enum symbol if all types belong to the same enum.
 * Returns null if types are empty, don't have a common parent enum, or belong to different enums.
 */
export function findEnumParentSymbol(
  types: readonly ts.Type[],
): ts.Symbol | null {
  if (types.length === 0) return null;

  const firstSymbol = types[0]!.symbol as SymbolWithParent | undefined;
  const parentSymbol = firstSymbol?.parent;

  if (!parentSymbol || !(parentSymbol.flags & ts.SymbolFlags.Enum)) {
    return null;
  }

  const allBelongToSameEnum = types.every((t) => {
    const sym = t.symbol as SymbolWithParent | undefined;
    return sym?.parent === parentSymbol;
  });

  return allBelongToSameEnum ? parentSymbol : null;
}

/**
 * Checks if a union type is a boolean union (true | false with optional null/undefined).
 */
export function isBooleanUnion(type: ts.Type): boolean {
  if (!type.isUnion()) return false;
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
  checker: ts.TypeChecker,
): ts.Symbol {
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
}
