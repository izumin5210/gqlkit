/**
 * Branded scalar type detector.
 *
 * This module provides functions to detect branded scalar types
 * from @gqlkit-ts/runtime and return their GraphQL scalar mapping.
 */

import ts from "typescript";
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
  readonly registry: ScalarRegistry | null;
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
  options: DetectBrandedScalarOptions | null = null,
): DetectionResult {
  const diagnostics: Diagnostic[] = [];
  const registry = options?.registry ?? null;

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
 * Detects if a property uses a scalar type alias from @gqlkit-ts/runtime
 * by examining the type node in the property declaration.
 *
 * This is necessary because TypeScript expands simple type aliases like
 * `type IDString = string` to their underlying type. To preserve the
 * original type reference, we need to look at the source code's type node.
 *
 * @param propSymbol - The property symbol to check
 * @param checker - The TypeScript type checker
 * @param options - Optional detection options including ScalarRegistry
 * @returns Detection result with scalar info if found
 */
export function detectScalarFromPropertySymbol(
  propSymbol: ts.Symbol,
  checker: ts.TypeChecker,
  options: DetectBrandedScalarOptions | null = null,
): DetectionResult {
  const diagnostics: Diagnostic[] = [];
  const registry = options?.registry ?? null;

  const declarations = propSymbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return { scalarInfo: undefined, unknownBrand: undefined, diagnostics };
  }

  const declaration = declarations[0];
  if (!declaration || !ts.isPropertySignature(declaration)) {
    return { scalarInfo: undefined, unknownBrand: undefined, diagnostics };
  }

  const typeNode = declaration.type;
  if (!typeNode || !ts.isTypeReferenceNode(typeNode)) {
    return { scalarInfo: undefined, unknownBrand: undefined, diagnostics };
  }

  const typeName = typeNode.typeName;
  if (!ts.isIdentifier(typeName)) {
    return { scalarInfo: undefined, unknownBrand: undefined, diagnostics };
  }

  const typeNameSymbol = checker.getSymbolAtLocation(typeName);
  if (!typeNameSymbol) {
    return { scalarInfo: undefined, unknownBrand: undefined, diagnostics };
  }

  const symbolName = typeNameSymbol.getName();

  // Check if it's a direct import alias from runtime
  if (typeNameSymbol.flags & ts.SymbolFlags.Alias) {
    try {
      const aliasedSymbol = checker.getAliasedSymbol(typeNameSymbol);
      if (aliasedSymbol) {
        const aliasedDecls = aliasedSymbol.getDeclarations();
        if (aliasedDecls && aliasedDecls.length > 0) {
          const aliasedDeclFile = aliasedDecls[0]?.getSourceFile().fileName;
          if (aliasedDeclFile?.includes("@gqlkit-ts/runtime")) {
            if (isKnownBrandedScalar(symbolName)) {
              const mapping = getScalarMapping(symbolName);
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
                typeName: symbolName,
                importSource: "@gqlkit-ts/runtime",
              },
              diagnostics,
            };
          }

          // Check for custom scalar from registry
          if (registry && aliasedDeclFile) {
            const customMapping = registry.getMapping(
              symbolName,
              aliasedDeclFile,
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
    } catch {
      // getAliasedSymbol can throw for non-alias symbols
    }
  }

  return { scalarInfo: undefined, unknownBrand: undefined, diagnostics };
}
