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
 * List of TypeScript built-in utility types that should be resolved
 * to their actual properties when used in args.
 */
export const BUILTIN_UTILITY_TYPES = [
  "Omit",
  "Pick",
  "Partial",
  "Required",
  "Readonly",
  "Record",
  "Exclude",
  "Extract",
  "NonNullable",
  "Parameters",
  "ReturnType",
  "InstanceType",
  "Awaited",
] as const;

/**
 * Checks if a type name is a built-in utility type like Omit, Pick, etc.
 */
export function isBuiltinUtilityTypeName(name: string): boolean {
  return (BUILTIN_UTILITY_TYPES as readonly string[]).includes(name);
}

/**
 * Checks if a type is a built-in utility type like Omit, Pick, etc.
 */
export function isBuiltinUtilityType(type: ts.Type): boolean {
  if (!type.aliasSymbol) {
    return false;
  }
  return isBuiltinUtilityTypeName(type.aliasSymbol.getName());
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

export interface ShouldTreatIntersectionAsInlineOptions {
  readonly checkBuiltinUtilityTypes?: boolean;
}

/**
 * Determines if an intersection type should be treated as an inline object.
 * Returns true when:
 * - Case 1: Has at least one anonymous/inline member (and optionally utility type member)
 * - Case 2: All members are object-like types that should be merged
 */
export function shouldTreatIntersectionAsInline(
  type: ts.IntersectionType,
  options: ShouldTreatIntersectionAsInlineOptions = {},
): boolean {
  const { checkBuiltinUtilityTypes = false } = options;

  const hasResolvableMember = type.types.some(
    (t) =>
      isInlineObjectType(t) ||
      isAnonymousObjectType(t) ||
      (checkBuiltinUtilityTypes && isBuiltinUtilityType(t)),
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
