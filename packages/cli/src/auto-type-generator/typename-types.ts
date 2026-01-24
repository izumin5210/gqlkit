/**
 * Common types for typename-related functionality.
 * These types are shared across typename-extractor, typename-validator,
 * typename-resolve-type-generator, and inline-union-validator.
 */

/**
 * All recognized field names for type discrimination.
 * - "__typename" is the standard GraphQL introspection field
 * - "$typeName" is a gqlkit-specific alternative that won't appear in the schema
 *
 * To add a new typename field:
 * 1. Add the field name to this array
 * 2. Update findTypenameProperty priority if needed
 */
export const TYPENAME_FIELD_NAMES = ["__typename", "$typeName"] as const;

/**
 * The field name used for type discrimination.
 */
export type TypenameFieldName = (typeof TYPENAME_FIELD_NAMES)[number];

/**
 * A set of typename field names used in a resolve type pattern.
 */
export type TypenameFieldNameSet = ReadonlySet<TypenameFieldName>;

/**
 * Create a TypenameFieldNameSet from field names.
 */
export function createFieldNameSet(
  fieldNames: ReadonlyArray<TypenameFieldName>,
): TypenameFieldNameSet {
  return new Set(fieldNames);
}

/**
 * Information about a typename field extracted from a type definition.
 */
export interface TypenameFieldInfo {
  readonly typeName: string;
  readonly fieldName: TypenameFieldName;
}

/**
 * Find __typename or $typeName property from a list of properties.
 * __typename takes priority over $typeName.
 */
export function findTypenameProperty<T>(
  properties: ReadonlyArray<T>,
  getName: (p: T) => string,
): { property: T; fieldName: TypenameFieldName } | null {
  const typenameProperty = properties.find((p) => getName(p) === "__typename");
  if (typenameProperty) {
    return { property: typenameProperty, fieldName: "__typename" };
  }

  const dollarTypenameProperty = properties.find(
    (p) => getName(p) === "$typeName",
  );
  if (dollarTypenameProperty) {
    return { property: dollarTypenameProperty, fieldName: "$typeName" };
  }

  return null;
}
