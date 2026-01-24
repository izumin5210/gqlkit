/**
 * Common types for typename-related functionality.
 * These types are shared across typename-extractor, typename-validator,
 * typename-resolve-type-generator, and inline-union-validator.
 */

/**
 * The field name used for type discrimination.
 * - "__typename" is the standard GraphQL introspection field
 * - "$typeName" is a gqlkit-specific alternative that won't appear in the schema
 */
export type TypenameFieldName = "__typename" | "$typeName";

/**
 * Information about a typename field extracted from a type definition.
 */
export interface TypenameFieldInfo {
  readonly typeName: string;
  readonly fieldName: TypenameFieldName;
}

/**
 * Type structure for extracting typename from a property.
 */
interface TypeWithLiteralInfo {
  readonly nullable: boolean;
  readonly kind: string;
  readonly name: string | null;
}

interface PropertyForTypenameExtraction {
  readonly name: string;
  readonly type: TypeWithLiteralInfo;
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

/**
 * Extract typename info from a property's type if it's a non-nullable string literal.
 */
export function extractTypenameFromProperty(
  property: PropertyForTypenameExtraction,
  fieldName: TypenameFieldName,
): TypenameFieldInfo | null {
  const { type } = property;

  if (type.nullable) {
    return null;
  }

  if (type.kind === "literal" && type.name !== null) {
    return { typeName: type.name, fieldName };
  }

  return null;
}
