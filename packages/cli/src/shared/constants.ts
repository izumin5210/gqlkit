/**
 * TypeScript internal symbol names.
 *
 * These are internal names used by the TypeScript compiler to represent
 * certain types. They should be treated as implementation details and
 * filtered out when converting TypeScript types to GraphQL types.
 */

/**
 * Anonymous object type symbol name.
 *
 * When TypeScript encounters an anonymous object type (e.g., `{ name: string }`
 * without a type alias), it uses `__type` as the internal symbol name.
 *
 * This commonly occurs when:
 * 1. A type is defined inline without a name
 * 2. A type reference is resolved through complex type operations
 *    (e.g., extracting from optional properties, intersection types)
 * 3. The original type name is lost during TypeScript's internal type resolution
 *
 * In the context of GqlFieldDef<T, Meta>, when we extract T from the
 * `$gqlkitOriginalType` property, TypeScript may return the type with
 * `__type` as its symbol name instead of the original type name (e.g., "NestedConfig").
 * This happens because:
 * - The property is optional (`T | undefined`)
 * - TypeScript's type resolution doesn't always preserve the original type alias
 *
 * When we encounter `__type`, we should fall back to using `checker.typeToString()`
 * which preserves the human-readable type name.
 */
const TS_ANONYMOUS_TYPE_SYMBOL = "__type";

/**
 * Array type symbol name.
 *
 * TypeScript uses `Array` as the symbol name for array types.
 * This should be handled separately using `checker.isArrayType()` rather than
 * treating it as a named type reference.
 */
const TS_ARRAY_TYPE_SYMBOL = "Array";

/**
 * Checks if a symbol name represents a TypeScript internal/anonymous type
 * that should not be used directly as a GraphQL type name.
 *
 * @param symbolName - The symbol name from `type.symbol.getName()`
 * @returns true if the symbol name is internal and should be filtered out
 */
export function isInternalTypeSymbol(symbolName: string): boolean {
  return (
    symbolName === TS_ANONYMOUS_TYPE_SYMBOL ||
    symbolName === TS_ARRAY_TYPE_SYMBOL
  );
}

// ============================================================
// gqlkit Metadata Property Names
// ============================================================

/**
 * Property names used internally by gqlkit types for metadata.
 * These start with " $" (space + dollar sign) to avoid conflicts.
 */
export const METADATA_PROPERTIES = {
  /** Field metadata (GqlFieldDef) */
  FIELD_META: " $gqlkitFieldMeta",
  /** Type metadata (GqlTypeDef) */
  TYPE_META: " $gqlkitTypeMeta",
  /** Directive name */
  DIRECTIVE_NAME: " $directiveName",
  /** Directive arguments */
  DIRECTIVE_ARGS: " $directiveArgs",
  /** Directive location */
  DIRECTIVE_LOCATION: " $directiveLocation",
  /** Original unwrapped type */
  ORIGINAL_TYPE: " $gqlkitOriginalType",
  /** Scalar metadata */
  SCALAR: " $gqlkitScalar",
  /** Resolver metadata */
  RESOLVER: " $gqlkitResolver",
  /** Interface metadata */
  INTERFACE_META: " $gqlkitInterfaceMeta",
} as const;

// ============================================================
// GraphQL Built-in Types
// ============================================================

/**
 * GraphQL built-in scalar type names.
 */
export const BUILT_IN_SCALARS = new Set([
  "ID",
  "Int",
  "Float",
  "String",
  "Boolean",
] as const);

/**
 * Checks if a type name is a GraphQL built-in scalar.
 */
export function isBuiltInScalar(typeName: string): boolean {
  return BUILT_IN_SCALARS.has(
    typeName as typeof BUILT_IN_SCALARS extends Set<infer T> ? T : never,
  );
}

// ============================================================
// TypeScript to GraphQL Type Mapping
// ============================================================

/**
 * Maps TypeScript primitive type names to GraphQL scalar names.
 */
export const PRIMITIVE_TYPE_MAP: Record<string, string> = {
  string: "String",
  number: "Float",
  boolean: "Boolean",
} as const;
