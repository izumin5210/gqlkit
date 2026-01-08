/**
 * Default value metadata detector.
 *
 * This module provides functions to detect default value metadata embedded
 * in TypeScript intersection types using the $gqlkitFieldMeta property.
 */

import ts from "typescript";
import type { DirectiveArgumentValue } from "./directive-detector.js";
import { resolveArgumentValue } from "./directive-detector.js";
import { getActualMetadataType } from "./metadata-detector.js";

const FIELD_META_PROPERTY = " $gqlkitFieldMeta";
const DEFAULT_VALUE_PROPERTY = "defaultValue";

/**
 * Error codes for default value detection.
 */
export type DefaultValueDetectionErrorCode = "UNRESOLVABLE_DEFAULT_VALUE";

/**
 * Error information for default value detection.
 */
export interface DefaultValueDetectionError {
  readonly code: DefaultValueDetectionErrorCode;
  readonly message: string;
}

/**
 * Result of default value detection.
 */
export interface DefaultValueDetectionResult {
  readonly defaultValue: DirectiveArgumentValue | null;
  readonly errors: ReadonlyArray<DefaultValueDetectionError>;
}

function createEmptyResult(): DefaultValueDetectionResult {
  return {
    defaultValue: null,
    errors: [],
  };
}

/**
 * Gets the field meta property from a type, checking various type structures.
 */
function getFieldMetaProperty(type: ts.Type): ts.Symbol | undefined {
  const prop = type.getProperty(FIELD_META_PROPERTY);
  if (prop) {
    return prop;
  }

  if (type.isIntersection()) {
    for (const member of type.types) {
      const memberProp = member.getProperty(FIELD_META_PROPERTY);
      if (memberProp) {
        return memberProp;
      }
    }
  }

  if (type.isUnion()) {
    for (const member of type.types) {
      if (
        member.flags & ts.TypeFlags.Null ||
        member.flags & ts.TypeFlags.Undefined
      ) {
        continue;
      }
      const result = getFieldMetaProperty(member);
      if (result) {
        return result;
      }
    }
  }

  return undefined;
}

/**
 * Detects default value metadata from a TypeScript type.
 *
 * This function analyzes TypeScript types to detect default value metadata:
 * - Intersection types with " $gqlkitFieldMeta" property containing "defaultValue"
 * - Literal types are resolved to their values
 * - Non-literal types result in an error
 *
 * @param type - The TypeScript type to analyze
 * @param checker - The TypeScript type checker
 * @returns Detection result with default value and any errors
 */
export function detectDefaultValueMetadata(
  type: ts.Type,
  checker: ts.TypeChecker,
): DefaultValueDetectionResult {
  const metaProp = getFieldMetaProperty(type);
  if (!metaProp) {
    return createEmptyResult();
  }

  const rawMetaType = checker.getTypeOfSymbol(metaProp);
  const metaType = getActualMetadataType(rawMetaType);
  if (!metaType) {
    return createEmptyResult();
  }

  const defaultValueProp = metaType.getProperty(DEFAULT_VALUE_PROPERTY);
  if (!defaultValueProp) {
    return createEmptyResult();
  }

  const rawDefaultValueType = checker.getTypeOfSymbol(defaultValueProp);
  const typeString = checker.typeToString(rawDefaultValueType);

  // If defaultValue is undefined (not specified in Meta), return empty result
  // Check raw type first before unwrapping
  if (rawDefaultValueType.flags & ts.TypeFlags.Undefined) {
    return createEmptyResult();
  }

  // Check if the type is a union that only contains undefined
  // This handles cases where Meta["defaultValue"] resolves to undefined
  if (rawDefaultValueType.isUnion()) {
    const nonUndefinedTypes = rawDefaultValueType.types.filter(
      (t) => !(t.flags & ts.TypeFlags.Undefined),
    );
    if (nonUndefinedTypes.length === 0) {
      return createEmptyResult();
    }
  }

  // If the type string is "undefined", skip (handles edge cases)
  if (typeString === "undefined") {
    return createEmptyResult();
  }

  // If the type is unknown, it means Meta["defaultValue"] was not explicitly specified
  // and TypeScript inferred it from the constraint (defaultValue?: unknown)
  if (rawDefaultValueType.flags & ts.TypeFlags.Unknown) {
    return createEmptyResult();
  }

  const defaultValueType = getActualMetadataType(rawDefaultValueType);
  if (!defaultValueType) {
    return createEmptyResult();
  }

  // Also check the unwrapped type for undefined
  if (defaultValueType.flags & ts.TypeFlags.Undefined) {
    return createEmptyResult();
  }

  const resolved = resolveArgumentValue(defaultValueType, checker);
  if (resolved) {
    return {
      defaultValue: resolved,
      errors: [],
    };
  }

  return {
    defaultValue: null,
    errors: [
      {
        code: "UNRESOLVABLE_DEFAULT_VALUE",
        message:
          "Default value must be a literal type (string, number, boolean, null, array, object, or enum)",
      },
    ],
  };
}
