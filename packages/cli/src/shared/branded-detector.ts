/**
 * Branded scalar type detector.
 *
 * This module provides functions to detect branded scalar types
 * from @gqlkit-ts/runtime and return their GraphQL scalar mapping.
 */

import type ts from "typescript";
import type { Diagnostic } from "../type-extractor/types/index.js";
import {
  getScalarMapping,
  isKnownBrandedScalar,
  type ScalarRegistry,
} from "./scalar-registry.js";
import { resolveSymbolOrigin } from "./symbol-resolver.js";

/**
 * Information about a detected scalar type.
 */
export interface ScalarTypeInfo {
  /** The GraphQL scalar type name (ID, Int, Float, String, Boolean, or custom scalar name) */
  readonly scalarName: string;
  /** The branded type name (e.g., "IDString", "Int", "DateTime") */
  readonly brandName: string;
  /** The underlying TypeScript primitive type (undefined for custom scalars) */
  readonly baseType: "string" | "number" | undefined;
  /** Whether this is a custom scalar */
  readonly isCustom: boolean;
}

/**
 * Information about an unknown branded type from @gqlkit-ts/runtime.
 */
export interface UnknownBrandInfo {
  /** The unknown type name */
  readonly typeName: string;
  /** The import source (e.g., "@gqlkit-ts/runtime") */
  readonly importSource: string;
}

/**
 * Result of branded scalar detection.
 */
export interface DetectionResult {
  /** The scalar type info if a branded scalar was detected, undefined otherwise */
  readonly scalarInfo: ScalarTypeInfo | undefined;
  /** Information about unknown branded type if detected from runtime but not recognized */
  readonly unknownBrand: UnknownBrandInfo | undefined;
  /** Any diagnostics generated during detection */
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

/**
 * Options for detecting branded scalars.
 */
export interface DetectBrandedScalarOptions {
  /** Optional ScalarRegistry for custom scalar detection */
  readonly registry?: ScalarRegistry;
}

/**
 * Detects if a TypeScript type is a branded scalar type from @gqlkit-ts/runtime
 * or a custom scalar defined in the configuration.
 *
 * @param type - The TypeScript type to check
 * @param checker - The TypeScript type checker
 * @param options - Optional detection options including ScalarRegistry
 * @returns Detection result with scalar info if found
 */
export function detectBrandedScalar(
  type: ts.Type,
  checker: ts.TypeChecker,
  options?: DetectBrandedScalarOptions,
): DetectionResult {
  const diagnostics: Diagnostic[] = [];
  const registry = options?.registry;

  const aliasSymbol = type.aliasSymbol;
  if (aliasSymbol) {
    const origin = resolveSymbolOrigin(aliasSymbol, checker);
    if (origin) {
      if (origin.isFromRuntime) {
        const brandName = origin.symbolName;
        if (isKnownBrandedScalar(brandName)) {
          const mapping = getScalarMapping(brandName);
          if (mapping) {
            return {
              scalarInfo: {
                scalarName: mapping.graphqlScalar,
                brandName: mapping.brandName,
                baseType: mapping.baseType,
                isCustom: false,
              },
              unknownBrand: undefined,
              diagnostics: [],
            };
          }
        }
        return {
          scalarInfo: undefined,
          unknownBrand: {
            typeName: brandName,
            importSource: origin.moduleName,
          },
          diagnostics,
        };
      }

      if (registry && origin.sourceFilePath) {
        const customMapping = registry.getMapping(
          origin.symbolName,
          origin.sourceFilePath,
        );
        if (customMapping) {
          return {
            scalarInfo: {
              scalarName: customMapping.graphqlScalar,
              brandName: customMapping.typeName,
              baseType: undefined,
              isCustom: true,
            },
            unknownBrand: undefined,
            diagnostics: [],
          };
        }
      }
    }
  }

  const symbol = type.getSymbol();
  if (symbol) {
    const origin = resolveSymbolOrigin(symbol, checker);
    if (origin) {
      if (origin.isFromRuntime) {
        const brandName = origin.symbolName;
        if (isKnownBrandedScalar(brandName)) {
          const mapping = getScalarMapping(brandName);
          if (mapping) {
            return {
              scalarInfo: {
                scalarName: mapping.graphqlScalar,
                brandName: mapping.brandName,
                baseType: mapping.baseType,
                isCustom: false,
              },
              unknownBrand: undefined,
              diagnostics: [],
            };
          }
        }
        return {
          scalarInfo: undefined,
          unknownBrand: {
            typeName: brandName,
            importSource: origin.moduleName,
          },
          diagnostics,
        };
      }

      if (registry && origin.sourceFilePath) {
        const customMapping = registry.getMapping(
          origin.symbolName,
          origin.sourceFilePath,
        );
        if (customMapping) {
          return {
            scalarInfo: {
              scalarName: customMapping.graphqlScalar,
              brandName: customMapping.typeName,
              baseType: undefined,
              isCustom: true,
            },
            unknownBrand: undefined,
            diagnostics: [],
          };
        }
      }
    }
  }

  return {
    scalarInfo: undefined,
    unknownBrand: undefined,
    diagnostics,
  };
}

/**
 * Checks if a TypeScript type is a branded scalar type from @gqlkit-ts/runtime.
 *
 * @param type - The TypeScript type to check
 * @param checker - The TypeScript type checker
 * @returns true if the type is a known branded scalar, false otherwise
 */
export function isBrandedScalarType(
  type: ts.Type,
  checker: ts.TypeChecker,
): boolean {
  const result = detectBrandedScalar(type, checker);
  return result.scalarInfo !== undefined;
}
