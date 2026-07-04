/**
 * The CLI <-> runtime marker/metadata contract and pipeline-wide naming
 * conventions (refactor-plan.md §3.1, §3.3): the space-prefixed property
 * names gqlkit uses to detect its own runtime types by shape, the set of
 * GraphQL built-in scalars, the TypeScript-primitive-to-GraphQL-scalar
 * mapping, and the field names used for type discrimination.
 */

// ============================================================
// gqlkit Metadata Property Names
// ============================================================

/**
 * Property names used internally by gqlkit types for metadata.
 * These start with " $" (space + dollar sign) to avoid conflicts.
 */
export const METADATA_PROPERTIES = {
  /** Field metadata (GqlField) */
  FIELD_META: " $gqlkitFieldMeta",
  /** Type metadata (GqlObject) */
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
  /** Abstract resolver metadata (resolveType, isTypeOf) */
  ABSTRACT_RESOLVER: " $gqlkitAbstractResolver",
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

// ============================================================
// Typename Discrimination
// ============================================================

/**
 * All recognized field names for type discrimination.
 * - "__typename" is the standard GraphQL introspection field
 * - "$typeName" is a gqlkit-specific alternative that won't appear in the schema
 *
 * To add a new typename field:
 * 1. Add the field name to this array
 * 2. Update findTypenameProperty priority if needed (auto-type-generator/typename-types.ts)
 */
export const TYPENAME_FIELD_NAMES = ["__typename", "$typeName"] as const;

/**
 * Check if a field name is a typename discrimination field.
 */
export function isTypenameFieldName(name: string): boolean {
  return (TYPENAME_FIELD_NAMES as readonly string[]).includes(name);
}

/**
 * The field name used for type discrimination.
 */
export type TypenameFieldName = (typeof TYPENAME_FIELD_NAMES)[number];
