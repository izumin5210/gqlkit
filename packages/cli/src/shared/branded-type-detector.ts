/**
 * Branded type detector.
 *
 * This module provides functions to detect branded type patterns in TypeScript
 * intersection types and extract the underlying primitive type.
 *
 * Branded types are intersection types combining a primitive with a marker object:
 * - `string & { __brand: 'UserId' }`
 * - `number & { readonly __brand: unique symbol }`
 * - `boolean & { __nominal: true }`
 */

import ts from "typescript";

/**
 * Result of branded type detection.
 */
export interface BrandedTypeResult {
  /** Whether the type is a branded primitive type */
  readonly isBranded: boolean;
  /** The base primitive type if branded, null otherwise */
  readonly baseType: "string" | "number" | "boolean" | null;
}

/**
 * Property names commonly used as brand markers.
 * These indicate the type is a branded type, not an actual object.
 */
const BRAND_PROPERTY_NAMES: ReadonlySet<string> = new Set([
  "__brand",
  "_brand",
  "brand",
  "__nominal",
  "_nominal",
  "__tag",
  "_tag",
  "__type",
]);

/**
 * Property names to exclude from brand detection.
 * These are used by gqlkit for scalar metadata, not branding.
 */
const EXCLUDED_BRAND_PROPERTIES: ReadonlySet<string> = new Set([
  " $gqlkitScalar",
]);

/**
 * Detects if a type is a branded primitive type.
 *
 * A branded type is an intersection type where:
 * 1. One member is a primitive type (string, number, or boolean)
 * 2. Other members are pure brand markers (objects with only brand properties)
 *
 * @param type - The TypeScript type to analyze
 * @returns Detection result with isBranded flag and baseType
 */
export function detectBrandedType(type: ts.Type): BrandedTypeResult {
  const notBranded: BrandedTypeResult = { isBranded: false, baseType: null };

  if (!type.isIntersection()) {
    return notBranded;
  }

  let primitiveBase: "string" | "number" | "boolean" | null = null;
  let hasNonBrandMember = false;

  for (const member of type.types) {
    const primitiveType = getPrimitiveType(member);
    if (primitiveType !== null) {
      if (primitiveBase !== null && primitiveBase !== primitiveType) {
        // Multiple different primitive types - not a valid branded type
        return notBranded;
      }
      primitiveBase = primitiveType;
      continue;
    }

    // Check if this member is a pure brand marker
    if (!isPureBrandMarker(member)) {
      hasNonBrandMember = true;
      break;
    }
  }

  if (hasNonBrandMember || primitiveBase === null) {
    return notBranded;
  }

  return { isBranded: true, baseType: primitiveBase };
}

/**
 * Detects if all types in the array are branded with the same base type.
 *
 * This is useful for union types where branded boolean expands to:
 * `(true & { __nominal: true }) | (false & { __nominal: true })`
 *
 * @param types - Array of TypeScript types to analyze
 * @returns Common branded result if all types are branded with the same base, otherwise non-branded
 */
export function detectUniformBrandedType(
  types: ReadonlyArray<ts.Type>,
): BrandedTypeResult {
  if (types.length === 0) {
    return { isBranded: false, baseType: null };
  }

  const first = detectBrandedType(types[0]!);
  if (!first.isBranded) {
    return { isBranded: false, baseType: null };
  }

  for (let i = 1; i < types.length; i++) {
    const result = detectBrandedType(types[i]!);
    if (!result.isBranded || result.baseType !== first.baseType) {
      return { isBranded: false, baseType: null };
    }
  }

  return first;
}

/**
 * Gets the primitive type from a TypeScript type.
 *
 * @returns "string", "number", "boolean", or null if not a primitive
 */
function getPrimitiveType(
  type: ts.Type,
): "string" | "number" | "boolean" | null {
  if (type.flags & ts.TypeFlags.String) {
    return "string";
  }
  if (type.flags & ts.TypeFlags.Number) {
    return "number";
  }
  if (
    type.flags & ts.TypeFlags.Boolean ||
    type.flags & ts.TypeFlags.BooleanLiteral
  ) {
    return "boolean";
  }
  return null;
}

/**
 * Checks if a type is a pure brand marker.
 *
 * A pure brand marker is an object type where all properties are
 * brand-related (e.g., __brand, __nominal, __tag).
 *
 * @param type - The type to check
 * @returns true if the type is a pure brand marker
 */
function isPureBrandMarker(type: ts.Type): boolean {
  if (!(type.flags & ts.TypeFlags.Object)) {
    return false;
  }

  const properties = type.getProperties();
  if (properties.length === 0) {
    // Empty object is not a brand marker
    return false;
  }

  for (const prop of properties) {
    const propName = prop.getName();

    // Excluded properties (like gqlkit metadata) disqualify as brand marker
    if (EXCLUDED_BRAND_PROPERTIES.has(propName)) {
      return false;
    }

    // If any property is not a brand property, this is not a pure brand marker
    if (!BRAND_PROPERTY_NAMES.has(propName)) {
      return false;
    }
  }

  return true;
}
