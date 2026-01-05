/**
 * Scalar type registry for branded scalar types.
 *
 * This module manages mapping information from branded TypeScript types
 * to GraphQL scalar types. It provides the foundation for detecting
 * branded scalar types during type extraction.
 */

/**
 * Represents the mapping information for a branded scalar type.
 */
export interface ScalarMappingInfo {
  /** The name of the branded type (e.g., "IDString", "Int") */
  readonly brandName: string;
  /** The corresponding GraphQL scalar type */
  readonly graphqlScalar: "ID" | "Int" | "Float" | "String" | "Boolean";
  /** The underlying TypeScript primitive type */
  readonly baseType: "string" | "number";
}

/**
 * Extended scalar mapping information for both standard and custom scalars.
 */
export interface ExtendedScalarMappingInfo {
  /** GraphQL scalar name */
  readonly graphqlScalar: string;
  /** TypeScript type name */
  readonly typeName: string;
  /** Resolved import path (absolute) */
  readonly importPath: string;
  /** Whether this is a custom scalar */
  readonly isCustom: boolean;
  /** Usage constraint: "input" for input-only, "output" for output-only, undefined for both */
  readonly only?: "input" | "output";
}

/**
 * Registry for managing scalar type mappings.
 */
export interface ScalarRegistry {
  /**
   * Get mapping by type name and absolute import path.
   */
  getMapping(
    typeName: string,
    absoluteImportPath: string,
  ): ExtendedScalarMappingInfo | undefined;

  /**
   * Get all custom scalar names.
   */
  getCustomScalarNames(): ReadonlyArray<string>;
}

/**
 * Standard scalar mappings for the 4 branded types provided by @gqlkit-ts/runtime.
 * This map is immutable and serves as the default mapping configuration.
 */
const STANDARD_SCALAR_MAPPINGS: ReadonlyMap<string, ScalarMappingInfo> =
  new Map<string, ScalarMappingInfo>([
    [
      "IDString",
      Object.freeze({
        brandName: "IDString",
        graphqlScalar: "ID",
        baseType: "string",
      } as const),
    ],
    [
      "IDNumber",
      Object.freeze({
        brandName: "IDNumber",
        graphqlScalar: "ID",
        baseType: "number",
      } as const),
    ],
    [
      "Int",
      Object.freeze({
        brandName: "Int",
        graphqlScalar: "Int",
        baseType: "number",
      } as const),
    ],
    [
      "Float",
      Object.freeze({
        brandName: "Float",
        graphqlScalar: "Float",
        baseType: "number",
      } as const),
    ],
  ]);

/**
 * Retrieves the scalar mapping information for a given branded type name.
 *
 * @param brandName - The name of the branded type to look up
 * @returns The mapping information if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const mapping = getScalarMapping("IDString");
 * if (mapping) {
 *   console.log(mapping.graphqlScalar); // "ID"
 * }
 * ```
 */
export function getScalarMapping(
  brandName: string,
): ScalarMappingInfo | undefined {
  return STANDARD_SCALAR_MAPPINGS.get(brandName);
}

/**
 * Checks if a type name is a known branded scalar type.
 *
 * @param brandName - The name of the type to check
 * @returns true if the type is a known branded scalar, false otherwise
 *
 * @example
 * ```typescript
 * if (isKnownBrandedScalar("IDString")) {
 *   // Handle as branded scalar
 * }
 * ```
 */
export function isKnownBrandedScalar(brandName: string): boolean {
  return STANDARD_SCALAR_MAPPINGS.has(brandName);
}
