/**
 * IgnoreFields metadata detector.
 *
 * This module provides functions to detect ignoreFields metadata embedded
 * in TypeScript intersection types using the $gqlkitTypeMeta property.
 */

import ts from "typescript";
import { METADATA_PROPERTIES } from "./constants.js";
import { getActualMetadataType } from "./metadata-detector.js";

const TYPE_META_PROPERTY = METADATA_PROPERTIES.TYPE_META;

/**
 * Parameters for detectIgnoreFieldsMetadata function.
 */
export interface DetectIgnoreFieldsParams {
  readonly type: ts.Type;
  readonly checker: ts.TypeChecker;
}

/**
 * Extracts ignoreFields from a type's metadata.
 * Returns null if the type doesn't have $gqlkitTypeMeta or ignoreFields is not specified.
 */
function extractIgnoreFieldsFromType(
  type: ts.Type,
  checker: ts.TypeChecker,
): ReadonlySet<string> | null {
  const metaProp = type.getProperty(TYPE_META_PROPERTY);
  if (!metaProp) {
    return null;
  }

  const rawMetadataType = checker.getTypeOfSymbol(metaProp);
  const metadataType = getActualMetadataType(rawMetadataType);
  if (!metadataType) {
    return null;
  }

  const ignoreFieldsProp = metadataType.getProperty("ignoreFields");
  if (!ignoreFieldsProp) {
    return null;
  }

  const rawIgnoreFieldsType = checker.getTypeOfSymbol(ignoreFieldsProp);
  const ignoreFieldsType = getActualMetadataType(rawIgnoreFieldsType);
  if (!ignoreFieldsType) {
    return null;
  }

  return extractStringLiteralUnion(ignoreFieldsType);
}

/**
 * Extracts string literals from a type (single literal or union of literals).
 */
function extractStringLiteralUnion(type: ts.Type): ReadonlySet<string> | null {
  if (type.flags & ts.TypeFlags.StringLiteral) {
    const value = (type as ts.StringLiteralType).value;
    return new Set([value]);
  }

  if (type.isUnion()) {
    const values = new Set<string>();
    for (const member of type.types) {
      if (member.flags & ts.TypeFlags.StringLiteral) {
        values.add((member as ts.StringLiteralType).value);
      }
    }
    if (values.size > 0) {
      return values;
    }
  }

  return null;
}

/**
 * Detects ignoreFields metadata from a TypeScript type.
 *
 * This function analyzes TypeScript types to detect ignoreFields metadata
 * from the $gqlkitTypeMeta property. It extracts string literal or string
 * literal union types and returns them as a Set.
 *
 * @param params - The detection parameters containing type and checker
 * @returns The ignoreFields set or null if not specified
 */
export function detectIgnoreFieldsMetadata(
  params: DetectIgnoreFieldsParams,
): ReadonlySet<string> | null {
  const { type, checker } = params;

  const result = extractIgnoreFieldsFromType(type, checker);
  if (result) {
    return result;
  }

  if (type.isIntersection()) {
    for (const member of type.types) {
      const memberResult = extractIgnoreFieldsFromType(member, checker);
      if (memberResult) {
        return memberResult;
      }
    }
  }

  return null;
}
