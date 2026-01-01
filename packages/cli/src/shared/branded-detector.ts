/**
 * Branded scalar type detector.
 *
 * This module provides functions to detect branded scalar types
 * from @gqlkit-ts/runtime and return their GraphQL scalar mapping.
 */

import type ts from "typescript";
import type { Diagnostic } from "../type-extractor/types/index.js";
import { getScalarMapping, isKnownBrandedScalar } from "./scalar-registry.js";
import {
  isSymbolFromGqlkitRuntime,
  resolveSymbolOrigin,
} from "./symbol-resolver.js";

/**
 * Information about a detected scalar type.
 */
export interface ScalarTypeInfo {
  /** The GraphQL scalar type name (ID, Int, Float, String, Boolean) */
  readonly scalarName: "ID" | "Int" | "Float" | "String" | "Boolean";
  /** The branded type name (e.g., "IDString", "Int") */
  readonly brandName: string;
  /** The underlying TypeScript primitive type */
  readonly baseType: "string" | "number";
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
 * Detects if a TypeScript type is a branded scalar type from @gqlkit-ts/runtime.
 *
 * @param type - The TypeScript type to check
 * @param checker - The TypeScript type checker
 * @returns Detection result with scalar info if found
 */
export function detectBrandedScalar(
  type: ts.Type,
  checker: ts.TypeChecker,
): DetectionResult {
  const diagnostics: Diagnostic[] = [];

  const aliasSymbol = type.aliasSymbol;
  if (aliasSymbol && isSymbolFromGqlkitRuntime(aliasSymbol, checker)) {
    const origin = resolveSymbolOrigin(aliasSymbol, checker);
    if (origin && origin.isFromRuntime) {
      const brandName = origin.symbolName;
      if (isKnownBrandedScalar(brandName)) {
        const mapping = getScalarMapping(brandName);
        if (mapping) {
          return {
            scalarInfo: {
              scalarName: mapping.graphqlScalar,
              brandName: mapping.brandName,
              baseType: mapping.baseType,
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
  }

  const symbol = type.getSymbol();
  if (symbol && isSymbolFromGqlkitRuntime(symbol, checker)) {
    const origin = resolveSymbolOrigin(symbol, checker);
    if (origin && origin.isFromRuntime) {
      const brandName = origin.symbolName;
      if (isKnownBrandedScalar(brandName)) {
        const mapping = getScalarMapping(brandName);
        if (mapping) {
          return {
            scalarInfo: {
              scalarName: mapping.graphqlScalar,
              brandName: mapping.brandName,
              baseType: mapping.baseType,
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
