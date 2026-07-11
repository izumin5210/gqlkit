/**
 * Derives the numeric-enum and string-enum-mapping metadata resolver-map
 * generation needs to convert between GraphQL enum value names and their
 * original TypeScript values at runtime.
 */

import type { BaseType } from "./type-mapper.js";

/**
 * Numeric enum member value mapping.
 */
export interface NumericEnumMember {
  readonly name: string;
  readonly numericValue: number;
}

/**
 * Numeric enum information for resolver generation.
 */
export interface NumericEnumInfo {
  readonly enumName: string;
  readonly members: ReadonlyArray<NumericEnumMember>;
}

/**
 * String enum member value mapping.
 */
export interface StringEnumMember {
  /** GraphQL enum value name (SCREAMING_SNAKE_CASE) */
  readonly graphqlValue: string;
  /** Original TypeScript enum value */
  readonly typescriptValue: string;
}

/**
 * String enum information for resolver generation.
 */
export interface StringEnumMappingInfo {
  readonly enumName: string;
  readonly members: ReadonlyArray<StringEnumMember>;
}

export function collectNumericEnums(
  baseTypes: ReadonlyArray<BaseType>,
): ReadonlyArray<NumericEnumInfo> {
  return baseTypes
    .filter(
      (
        type,
      ): type is BaseType & {
        enumValues: NonNullable<BaseType["enumValues"]>;
      } =>
        type.kind === "Enum" && type.isNumericEnum && type.enumValues !== null,
    )
    .map((type) => ({
      enumName: type.name,
      members: type.enumValues
        .filter(
          (value): value is typeof value & { numericValue: number } =>
            value.numericValue !== null,
        )
        .map((value) => ({
          name: value.name,
          numericValue: value.numericValue,
        })),
    }))
    .filter((info) => info.members.length > 0);
}

export function collectStringEnumMappings(
  baseTypes: ReadonlyArray<BaseType>,
): ReadonlyArray<StringEnumMappingInfo> {
  return baseTypes
    .filter(
      (
        type,
      ): type is BaseType & {
        enumValues: NonNullable<BaseType["enumValues"]>;
      } =>
        type.kind === "Enum" &&
        type.needsStringEnumMapping &&
        type.enumValues !== null,
    )
    .map((type) => ({
      enumName: type.name,
      members: type.enumValues.map((value) => ({
        graphqlValue: value.name,
        typescriptValue: value.originalValue,
      })),
    }))
    .filter((info) => info.members.length > 0);
}
