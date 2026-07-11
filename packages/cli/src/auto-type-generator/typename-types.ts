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

import type { PropertyDef, TypenameFieldName } from "../core/index.js";

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

/**
 * Parameters for {@link extractTypenameValue}.
 */
export interface ExtractTypenameValueParams {
  readonly properties: ReadonlyArray<PropertyDef>;
  /**
   * Whether an optional (`?:`) typename property disqualifies extraction.
   * Call sites that already gate on optionality via their own diagnostics
   * (or that never observe optional typename properties by construction)
   * pass `false`.
   */
  readonly checkOptional: boolean;
  /**
   * Whether a nullable typename property disqualifies extraction.
   * Call sites that already gate on nullability via their own diagnostics
   * (or that never observe nullable typename properties by construction)
   * pass `false`.
   */
  readonly checkNullable: boolean;
}

/**
 * The single "extract the __typename/$typeName discriminator value" utility
 * (refactor-plan.md §1.2-D / §3.1). Finds the discriminator property via
 * {@link findTypenameProperty} (priority is never a per-site difference),
 * then validates it is a required, non-nullable string literal type — modulo
 * the two axes that genuinely differ per call site: whether optionality and
 * nullability are checked at all. Returns `null` on any disqualification;
 * callers that need a diagnostic per specific violation (rather than a
 * silent `null`) inspect `findTypenameProperty`'s result directly instead of
 * using this helper.
 */
export function extractTypenameValue(
  params: ExtractTypenameValueParams,
): TypenameFieldInfo | null {
  const { properties, checkOptional, checkNullable } = params;

  const found = findTypenameProperty(properties, (p) => p.name);
  if (!found) {
    return null;
  }

  const { property, fieldName } = found;
  if (checkOptional && property.optional) {
    return null;
  }

  const { tsType } = property;
  if (
    (checkNullable && tsType.nullable) ||
    tsType.kind !== "stringLiteral" ||
    tsType.name === null
  ) {
    return null;
  }

  return { typeName: tsType.name, fieldName };
}
