/**
 * OnlyValidator - validates only constraints for scalar types.
 *
 * This module checks that scalar types with only: "input" are not used in
 * output positions, and scalar types with only: "output" are not used in
 * input positions.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import type { ScalarMetadataInfo } from "../../shared/scalar-metadata-detector.js";
import type { TSTypeReference } from "../../type-extractor/types/index.js";
import type { DefineApiResolverInfo } from "../extractor/define-api-extractor.js";

/**
 * Type of only constraint violation.
 */
export type OnlyViolationCode =
  | "OUTPUT_ONLY_IN_INPUT_POSITION"
  | "INPUT_ONLY_IN_OUTPUT_POSITION";

/**
 * Position where the violation occurred.
 */
export type ViolationPosition = "argument" | "return";

/**
 * Information about an only constraint violation.
 */
export interface OnlyConstraintViolation {
  readonly code: OnlyViolationCode;
  readonly position: ViolationPosition;
  readonly typeName: string;
  readonly scalarName: string;
  readonly fieldName: string;
  readonly message: string;
}

/**
 * Map of TypeScript type names to their only constraint.
 */
type OnlyConstraintMap = Map<string, { only: "input" | "output" | null }>;

/**
 * Builds a map from TypeScript type names to their only constraint.
 */
function buildOnlyConstraintMap(
  scalarInfos: ReadonlyArray<ScalarMetadataInfo>,
): OnlyConstraintMap {
  const map: OnlyConstraintMap = new Map();
  for (const info of scalarInfos) {
    if (info.typeName) {
      map.set(info.typeName, { only: info.only });
    }
  }
  return map;
}

/**
 * Collects scalar type names from a TSTypeReference recursively.
 */
function collectScalarTypeNames(
  typeRef: TSTypeReference,
): ReadonlyArray<string> {
  const names: string[] = [];

  if (typeRef.scalarInfo) {
    names.push(typeRef.scalarInfo.brandName);
  }

  if (typeRef.elementType) {
    names.push(...collectScalarTypeNames(typeRef.elementType));
  }

  if (typeRef.members) {
    for (const member of typeRef.members) {
      names.push(...collectScalarTypeNames(member));
    }
  }

  return names;
}

/**
 * Validates input position types (args).
 * Checks that no output-only scalar is used in input position.
 */
function validateInputPosition(
  resolverInfo: DefineApiResolverInfo,
  constraintMap: OnlyConstraintMap,
): ReadonlyArray<OnlyConstraintViolation> {
  const violations: OnlyConstraintViolation[] = [];

  if (!resolverInfo.args) {
    return violations;
  }

  for (const arg of resolverInfo.args) {
    const typeNames = collectScalarTypeNames(arg.tsType);

    for (const typeName of typeNames) {
      const constraint = constraintMap.get(typeName);
      if (constraint?.only === "output") {
        violations.push({
          code: "OUTPUT_ONLY_IN_INPUT_POSITION",
          position: "argument",
          typeName,
          scalarName: arg.tsType.scalarInfo?.scalarName ?? typeName,
          fieldName: resolverInfo.fieldName,
          message: `Type "${typeName}" is marked as output-only but is used in an input position (argument "${arg.name}" of resolver "${resolverInfo.fieldName}"). Use an input-compatible type instead.`,
        });
      }
    }
  }

  return violations;
}

/**
 * Validates output position types (return type).
 * Checks that no input-only scalar is used in output position.
 */
function validateOutputPosition(
  resolverInfo: DefineApiResolverInfo,
  constraintMap: OnlyConstraintMap,
): ReadonlyArray<OnlyConstraintViolation> {
  const violations: OnlyConstraintViolation[] = [];

  const typeNames = collectScalarTypeNames(resolverInfo.returnType);

  for (const typeName of typeNames) {
    const constraint = constraintMap.get(typeName);
    if (constraint?.only === "input") {
      violations.push({
        code: "INPUT_ONLY_IN_OUTPUT_POSITION",
        position: "return",
        typeName,
        scalarName: resolverInfo.returnType.scalarInfo?.scalarName ?? typeName,
        fieldName: resolverInfo.fieldName,
        message: `Type "${typeName}" is marked as input-only but is used in an output position (return type of resolver "${resolverInfo.fieldName}"). Use an output-compatible type instead.`,
      });
    }
  }

  return violations;
}

/**
 * Validates only constraints for scalar types in a resolver.
 *
 * @param resolverInfo - The resolver information to validate
 * @param scalarInfos - The scalar metadata information for lookup
 * @returns Array of violations found
 */
export function validateOnlyConstraints(
  resolverInfo: DefineApiResolverInfo,
  scalarInfos: ReadonlyArray<ScalarMetadataInfo>,
): ReadonlyArray<OnlyConstraintViolation> {
  const constraintMap = buildOnlyConstraintMap(scalarInfos);
  const violations: OnlyConstraintViolation[] = [];

  violations.push(...validateInputPosition(resolverInfo, constraintMap));
  violations.push(...validateOutputPosition(resolverInfo, constraintMap));

  return violations;
}
