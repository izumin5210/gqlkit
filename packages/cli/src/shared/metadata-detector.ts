/**
 * Metadata type unwrapping helper.
 *
 * Shared across scalar, directive, ignoreFields, and default-value metadata
 * detectors to extract the actual type from an optional metadata property.
 */

import * as ts from "../core/typescript.js";

/**
 * Extracts the actual type from an optional property type (T | undefined).
 * Used by both scalar and resolver metadata detection.
 *
 * For simple cases like `T | undefined`, returns T.
 * For union cases like `T | null | undefined`, returns the original union type
 * so the caller can analyze it (e.g., check for null members).
 * For boolean types (true | false | undefined), reconstructs the boolean type.
 *
 * @param metadataType - The type of the metadata property (may be union with undefined)
 * @returns The actual type excluding undefined, or null if extraction fails
 */
export async function getActualMetadataType(
  metadataType: ts.Type,
): Promise<ts.Type | null> {
  if (metadataType.isUnionType()) {
    const nonUndefinedTypes = (await metadataType.getTypes()).filter(
      (t) => !(t.flags & ts.TypeFlags.Undefined),
    );
    if (nonUndefinedTypes.length === 1) {
      return nonUndefinedTypes[0]!;
    }
    // Special case: boolean (true | false) optionally with undefined
    // TypeScript represents boolean | undefined as true | false | undefined
    if (
      nonUndefinedTypes.length === 2 &&
      nonUndefinedTypes.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)
    ) {
      // This is effectively "boolean" - return the first member to preserve
      // the boolean literal nature, or we could return the union
      return metadataType;
    }
    // If there are multiple non-undefined types (e.g., string | null),
    // return the original metadataType. The caller should analyze this
    // union type and handle null members appropriately.
    if (nonUndefinedTypes.length > 1) {
      // Return the original type - caller will need to filter out undefined
      // when checking for nullability
      return metadataType;
    }
    return null;
  }
  return metadataType;
}
