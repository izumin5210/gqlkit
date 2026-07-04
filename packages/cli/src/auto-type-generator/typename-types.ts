/**
 * Stage-specific typename helpers for auto-type-generator.
 * These are shared across typename-extractor, typename-validator,
 * typename-resolve-type-generator, and inline-union-validator.
 *
 * The core typename vocabulary (`TYPENAME_FIELD_NAMES`, `isTypenameFieldName`,
 * `TypenameFieldName`) lives in `core/metadata-contract.ts` since it is
 * consumed outside this stage (e.g. type-extractor); only the
 * stage-specific helpers below stay here.
 */

import type { TypenameFieldName } from "../core/index.js";

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
