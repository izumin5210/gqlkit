/**
 * IgnoreFields metadata detector.
 *
 * This module provides functions to detect ignoreFields metadata embedded
 * in TypeScript intersection types using the $gqlkitTypeMeta property.
 */

import { METADATA_PROPERTIES } from "../../core/index.js";
import * as ts from "../../core/typescript.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";
import { getActualMetadataType } from "../../shared/metadata-detector.js";

const TYPE_META_PROPERTY = METADATA_PROPERTIES.TYPE_META;

/**
 * Parameters for detectIgnoreFieldsMetadata function.
 */
export interface DetectIgnoreFieldsParams {
  readonly type: ts.Type;
  readonly checker: CheckerLoader;
}

/**
 * Extracts ignoreFields from a type's metadata.
 * Returns null if the type doesn't have $gqlkitTypeMeta or ignoreFields is not specified.
 */
async function extractIgnoreFieldsFromType(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<ReadonlySet<string> | null> {
  const metaProp = await checker.getPropertyOfType(type, TYPE_META_PROPERTY);
  if (!metaProp) {
    return null;
  }

  const rawMetadataType = await checker.getTypeOfSymbol(metaProp);
  const metadataType = await getActualMetadataType(rawMetadataType);
  if (!metadataType) {
    return null;
  }

  const ignoreFieldsProp = await checker.getPropertyOfType(
    metadataType,
    "ignoreFields",
  );
  if (!ignoreFieldsProp) {
    return null;
  }

  const rawIgnoreFieldsType = await checker.getTypeOfSymbol(ignoreFieldsProp);
  const ignoreFieldsType = await getActualMetadataType(rawIgnoreFieldsType);
  if (!ignoreFieldsType) {
    return null;
  }

  return extractStringLiteralUnion(ignoreFieldsType);
}

/**
 * Extracts string literals from a type (single literal or union of literals).
 */
async function extractStringLiteralUnion(
  type: ts.Type,
): Promise<ReadonlySet<string> | null> {
  if (type.flags & ts.TypeFlags.StringLiteral) {
    const value = (type as ts.StringLiteralType).value;
    return new Set([value]);
  }

  if (type.isUnionType()) {
    const values = new Set<string>();
    for (const member of await type.getTypes()) {
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
export async function detectIgnoreFieldsMetadata(
  params: DetectIgnoreFieldsParams,
): Promise<ReadonlySet<string> | null> {
  const { type, checker } = params;

  const result = await extractIgnoreFieldsFromType(type, checker);
  if (result) {
    return result;
  }

  if (type.isIntersectionType()) {
    for (const member of await type.getTypes()) {
      const memberResult = await extractIgnoreFieldsFromType(member, checker);
      if (memberResult) {
        return memberResult;
      }
    }
  }

  return null;
}
