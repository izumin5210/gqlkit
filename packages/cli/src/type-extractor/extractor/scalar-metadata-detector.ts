/**
 * Scalar metadata detector.
 *
 * This module provides functions to detect scalar metadata embedded
 * in TypeScript intersection types using the $gqlkitScalar property.
 */

import { METADATA_PROPERTIES } from "../../core/index.js";
import * as ts from "../../core/typescript.js";
import { getActualMetadataType } from "../../shared/metadata-detector.js";
import {
  getDeclarations,
  getPropertyByName,
  isNullOrUndefined,
} from "../../shared/typescript-utils.js";

const SCALAR_METADATA_PROPERTY = METADATA_PROPERTIES.SCALAR;

/**
 * Error information for mixed scalar union detection.
 */
export interface ScalarMetadataError {
  readonly code: "MIXED_SCALAR_UNION";
  readonly message: string;
  readonly scalarNames: ReadonlyArray<string>;
}

/**
 * Result of scalar metadata detection.
 */
export interface ScalarMetadataResult {
  /** The GraphQL scalar name if detected, null otherwise */
  readonly scalarName: string | null;
  /** Usage constraint: "input", "output", or null for both */
  readonly only: "input" | "output" | null;
  /** Whether the type is nullable (union with null) */
  readonly nullable: boolean;
  /** Whether the type is a list (array type) */
  readonly isList: boolean;
  /** Whether list items are nullable (for list types) */
  readonly listItemNullable: boolean;
  /** Whether this is a TypeScript primitive type */
  readonly isPrimitive: boolean;
  /** Whether this is an object type (not a scalar) */
  readonly isObjectType: boolean;
  /** Error if mixed scalar union is detected */
  readonly error: ScalarMetadataError | null;
}

interface InternalMetadata {
  scalarName: string | null;
  only: "input" | "output" | null;
  isPrimitive: boolean;
  isObjectType: boolean;
}

function createDefaultResult(): ScalarMetadataResult {
  return {
    scalarName: null,
    only: null,
    nullable: false,
    isList: false,
    listItemNullable: false,
    isPrimitive: false,
    isObjectType: false,
    error: null,
  };
}

function extractMetadataFromType(
  type: ts.Type,
  checker: ts.Checker,
): InternalMetadata | null {
  const metadataProp = getPropertyByName(type, SCALAR_METADATA_PROPERTY);
  if (!metadataProp) {
    return null;
  }

  const rawMetadataType = checker.getTypeOfSymbol(metadataProp);
  const metadataType = getActualMetadataType(rawMetadataType);
  if (!metadataType) {
    return null;
  }

  const nameProp = getPropertyByName(metadataType, "name");
  if (!nameProp) {
    return null;
  }

  const nameType = checker.getTypeOfSymbol(nameProp);
  if (!(nameType.flags & ts.TypeFlags.StringLiteral)) {
    return null;
  }

  const scalarName = (nameType as ts.StringLiteralType).value;

  const onlyProp = getPropertyByName(metadataType, "only");
  let only: "input" | "output" | null = null;
  if (onlyProp) {
    const onlyType = checker.getTypeOfSymbol(onlyProp);
    if (onlyType.flags & ts.TypeFlags.StringLiteral) {
      const onlyValue = (onlyType as ts.StringLiteralType).value;
      if (onlyValue === "input" || onlyValue === "output") {
        only = onlyValue;
      }
    }
  }

  return {
    scalarName,
    only,
    isPrimitive: false,
    isObjectType: false,
  };
}

function detectScalarMetadataFromIntersection(
  type: ts.Type,
  checker: ts.Checker,
): InternalMetadata | null {
  if (!type.isIntersectionType()) {
    return null;
  }

  for (const member of type.getTypes()) {
    const metadata = extractMetadataFromType(member, checker);
    if (metadata) {
      return metadata;
    }
  }

  return null;
}

function detectPrimitiveScalar(type: ts.Type): InternalMetadata | null {
  if (type.flags & ts.TypeFlags.String) {
    return {
      scalarName: "String",
      only: null,
      isPrimitive: true,
      isObjectType: false,
    };
  }
  if (type.flags & ts.TypeFlags.Number) {
    return {
      scalarName: "Float",
      only: null,
      isPrimitive: true,
      isObjectType: false,
    };
  }
  if (
    type.flags & ts.TypeFlags.Boolean ||
    type.flags & ts.TypeFlags.BooleanLiteral
  ) {
    return {
      scalarName: "Boolean",
      only: null,
      isPrimitive: true,
      isObjectType: false,
    };
  }

  return null;
}

function isBooleanLiteralUnion(types: readonly ts.Type[]): boolean {
  const nonNullTypes = types.filter((t) => !isNullOrUndefined(t));
  return (
    nonNullTypes.length === 2 &&
    nonNullTypes.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)
  );
}

function detectScalarMetadataCore(
  type: ts.Type,
  checker: ts.Checker,
): InternalMetadata | null {
  const primitiveResult = detectPrimitiveScalar(type);
  if (primitiveResult) {
    return primitiveResult;
  }

  const intersectionResult = detectScalarMetadataFromIntersection(
    type,
    checker,
  );
  if (intersectionResult) {
    return intersectionResult;
  }

  const directMetadata = extractMetadataFromType(type, checker);
  if (directMetadata) {
    return directMetadata;
  }

  const aliasSymbol = type.getAliasSymbol();
  if (aliasSymbol) {
    const aliasedType = checker.getDeclaredTypeOfSymbol(aliasSymbol);
    if (aliasedType !== type) {
      const aliasResult = detectScalarMetadataCore(aliasedType, checker);
      if (aliasResult) {
        return aliasResult;
      }
    }
  }

  const symbol = type.getSymbol();
  if (symbol) {
    const declarations = getDeclarations(symbol);
    if (declarations && declarations.length > 0) {
      for (const decl of declarations) {
        if (ts.isTypeAliasDeclaration(decl)) {
          const declSymbol = checker.getSymbolAtLocation(decl.name);
          if (declSymbol) {
            const declType = checker.getDeclaredTypeOfSymbol(declSymbol);
            if (declType !== type && declType.isIntersectionType()) {
              const result = detectScalarMetadataFromIntersection(
                declType,
                checker,
              );
              if (result) {
                return result;
              }
            }
          }
        }
      }
    }
  }

  return null;
}

function isObjectLikeType(type: ts.Type): boolean {
  if (type.flags & ts.TypeFlags.Object) {
    const objectType = type as ts.ObjectType;
    if (
      objectType.objectFlags & ts.ObjectFlags.Anonymous ||
      objectType.objectFlags & ts.ObjectFlags.Interface ||
      objectType.objectFlags & ts.ObjectFlags.Reference
    ) {
      const properties = type.getProperties();
      const hasOnlyMetadataProperty =
        properties.length === 1 &&
        properties[0]?.name === SCALAR_METADATA_PROPERTY;

      if (!hasOnlyMetadataProperty && properties.length > 0) {
        const metadataProp = getPropertyByName(type, SCALAR_METADATA_PROPERTY);
        if (!metadataProp) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Detects scalar metadata from a TypeScript type.
 *
 * This function analyzes TypeScript types to detect scalar metadata:
 * - TypeScript primitives (string, boolean, number) map to GraphQL scalars
 * - Intersection types with " $gqlkitScalar" property indicate custom scalars
 * - Type aliases are followed to find the underlying scalar metadata
 * - Unions with null indicate nullable types
 * - Array types indicate list types
 *
 * @param type - The TypeScript type to analyze
 * @param checker - The TypeScript type checker
 * @returns Detection result with scalar information
 */
export function detectScalarMetadata(
  type: ts.Type,
  checker: ts.Checker,
): ScalarMetadataResult {
  const result = createDefaultResult();

  if (checker.isArrayType(type)) {
    const typeRef = type as ts.TypeReference;
    const elementType = checker.getTypeArguments(typeRef)[0];

    if (!elementType) {
      return {
        ...result,
        isList: true,
        scalarName: "String",
      };
    }

    const elementResult = detectScalarMetadata(elementType, checker);
    return {
      ...result,
      scalarName: elementResult.scalarName,
      only: elementResult.only,
      isList: true,
      listItemNullable: elementResult.nullable,
      isPrimitive: elementResult.isPrimitive,
      error: elementResult.error,
    };
  }

  if (type.isUnionType()) {
    const nonNullTypes = type.getTypes().filter((t) => !isNullOrUndefined(t));
    const hasNull = type.getTypes().some((t) => isNullOrUndefined(t));

    if (isBooleanLiteralUnion(type.getTypes())) {
      return {
        ...result,
        scalarName: "Boolean",
        isPrimitive: true,
        nullable: hasNull,
      };
    }

    if (nonNullTypes.length === 0) {
      return result;
    }

    if (nonNullTypes.length === 1) {
      const innerType = nonNullTypes[0]!;

      if (checker.isArrayType(innerType)) {
        const innerResult = detectScalarMetadata(innerType, checker);
        return {
          ...innerResult,
          nullable: hasNull,
        };
      }

      const innerResult = detectScalarMetadata(innerType, checker);
      return {
        ...innerResult,
        nullable: hasNull || innerResult.nullable,
      };
    }

    const scalarNames = new Set<string>();
    const detectedResults: InternalMetadata[] = [];

    for (const unionMember of nonNullTypes) {
      const memberResult = detectScalarMetadataCore(unionMember, checker);
      if (memberResult?.scalarName) {
        scalarNames.add(memberResult.scalarName);
        detectedResults.push(memberResult);
      }
    }

    if (scalarNames.size > 1) {
      const scalarNameArray = Array.from(scalarNames).sort();
      return {
        ...result,
        nullable: hasNull,
        error: {
          code: "MIXED_SCALAR_UNION",
          message: `Cannot use union of different scalar types: ${scalarNameArray.join(", ")}`,
          scalarNames: scalarNameArray,
        },
      };
    }

    if (scalarNames.size === 1 && detectedResults.length > 0) {
      const firstResult = detectedResults[0]!;
      return {
        ...result,
        scalarName: firstResult.scalarName,
        only: firstResult.only,
        nullable: hasNull,
        isPrimitive: firstResult.isPrimitive,
      };
    }

    if (nonNullTypes.every((t) => isObjectLikeType(t))) {
      return {
        ...result,
        isObjectType: true,
        nullable: hasNull,
      };
    }

    return {
      ...result,
      nullable: hasNull,
    };
  }

  const coreResult = detectScalarMetadataCore(type, checker);
  if (coreResult) {
    return {
      ...result,
      scalarName: coreResult.scalarName,
      only: coreResult.only,
      isPrimitive: coreResult.isPrimitive,
      isObjectType: coreResult.isObjectType,
    };
  }

  if (isObjectLikeType(type)) {
    return {
      ...result,
      isObjectType: true,
    };
  }

  return result;
}
