/**
 * Scalar metadata detector.
 *
 * This module provides functions to detect scalar metadata embedded
 * in TypeScript intersection types using the $gqlkitScalar property.
 */

import { METADATA_PROPERTIES } from "../../core/index.js";
import * as ts from "../../core/typescript.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";
import { getActualMetadataType } from "../../shared/metadata-detector.js";
import { isNullOrUndefined } from "../../shared/typescript-utils.js";

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

async function extractMetadataFromType(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<InternalMetadata | null> {
  const metadataProp = await checker.getPropertyOfType(
    type,
    SCALAR_METADATA_PROPERTY,
  );
  if (!metadataProp) {
    return null;
  }

  const rawMetadataType = await checker.getTypeOfSymbol(metadataProp);
  const metadataType = await getActualMetadataType(rawMetadataType, checker);
  if (!metadataType) {
    return null;
  }

  const nameProp = await checker.getPropertyOfType(metadataType, "name");
  if (!nameProp) {
    return null;
  }

  const nameType = await checker.getTypeOfSymbol(nameProp);
  if (!(nameType.flags & ts.TypeFlags.StringLiteral)) {
    return null;
  }

  const scalarName = (nameType as ts.StringLiteralType).value;

  const onlyProp = await checker.getPropertyOfType(metadataType, "only");
  let only: "input" | "output" | null = null;
  if (onlyProp) {
    const onlyType = await checker.getTypeOfSymbol(onlyProp);
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

async function detectScalarMetadataFromIntersection(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<InternalMetadata | null> {
  if (!type.isIntersectionType()) {
    return null;
  }

  for (const member of await checker.getTypesOfType(type)) {
    const metadata = await extractMetadataFromType(member, checker);
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

async function detectScalarMetadataCore(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<InternalMetadata | null> {
  const primitiveResult = detectPrimitiveScalar(type);
  if (primitiveResult) {
    return primitiveResult;
  }

  const intersectionResult = await detectScalarMetadataFromIntersection(
    type,
    checker,
  );
  if (intersectionResult) {
    return intersectionResult;
  }

  const directMetadata = await extractMetadataFromType(type, checker);
  if (directMetadata) {
    return directMetadata;
  }

  const aliasSymbol = await checker.getAliasSymbolOfType(type);
  if (aliasSymbol) {
    const aliasedType = await checker.getDeclaredTypeOfSymbol(aliasSymbol);
    if (aliasedType !== type) {
      const aliasResult = await detectScalarMetadataCore(aliasedType, checker);
      if (aliasResult) {
        return aliasResult;
      }
    }
  }

  const symbol = await checker.getSymbolOfType(type);
  if (symbol) {
    const declarations = await checker.getDeclarationsOfSymbolOfKind(
      symbol,
      ts.SyntaxKind.TypeAliasDeclaration,
    );
    if (declarations && declarations.length > 0) {
      for (const decl of declarations) {
        if (ts.isTypeAliasDeclaration(decl)) {
          const declSymbol = await checker.getSymbolAtLocation(decl.name);
          if (declSymbol) {
            const declType = await checker.getDeclaredTypeOfSymbol(declSymbol);
            if (declType !== type && declType.isIntersectionType()) {
              const result = await detectScalarMetadataFromIntersection(
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

async function isObjectLikeType(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<boolean> {
  if (type.flags & ts.TypeFlags.Object) {
    const objectType = type as ts.ObjectType;
    if (
      objectType.objectFlags & ts.ObjectFlags.Anonymous ||
      objectType.objectFlags & ts.ObjectFlags.Interface ||
      objectType.objectFlags & ts.ObjectFlags.Reference
    ) {
      const properties = await checker.getPropertiesOfType(type);
      const hasOnlyMetadataProperty =
        properties.length === 1 &&
        properties[0]?.name === SCALAR_METADATA_PROPERTY;

      if (!hasOnlyMetadataProperty && properties.length > 0) {
        const metadataProp = await checker.getPropertyOfType(
          type,
          SCALAR_METADATA_PROPERTY,
        );
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
export async function detectScalarMetadata(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<ScalarMetadataResult> {
  const result = createDefaultResult();

  if (await checker.isArrayType(type)) {
    const typeRef = type as ts.TypeReference;
    const elementType = (await checker.getTypeArguments(typeRef))[0];

    if (!elementType) {
      return {
        ...result,
        isList: true,
        scalarName: "String",
      };
    }

    const elementResult = await detectScalarMetadata(elementType, checker);
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
    const nonNullTypes = (await checker.getTypesOfType(type)).filter(
      (t) => !isNullOrUndefined(t),
    );
    const hasNull = (await checker.getTypesOfType(type)).some((t) =>
      isNullOrUndefined(t),
    );

    if (isBooleanLiteralUnion(await checker.getTypesOfType(type))) {
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

      if (await checker.isArrayType(innerType)) {
        const innerResult = await detectScalarMetadata(innerType, checker);
        return {
          ...innerResult,
          nullable: hasNull,
        };
      }

      const innerResult = await detectScalarMetadata(innerType, checker);
      return {
        ...innerResult,
        nullable: hasNull || innerResult.nullable,
      };
    }

    const scalarNames = new Set<string>();
    const detectedResults: InternalMetadata[] = [];

    for (const unionMember of nonNullTypes) {
      const memberResult = await detectScalarMetadataCore(unionMember, checker);
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

    const objectLike = await Promise.all(
      nonNullTypes.map((t) => isObjectLikeType(t, checker)),
    );
    if (objectLike.every(Boolean)) {
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

  const coreResult = await detectScalarMetadataCore(type, checker);
  if (coreResult) {
    return {
      ...result,
      scalarName: coreResult.scalarName,
      only: coreResult.only,
      isPrimitive: coreResult.isPrimitive,
      isObjectType: coreResult.isObjectType,
    };
  }

  if (await isObjectLikeType(type, checker)) {
    return {
      ...result,
      isObjectType: true,
    };
  }

  return result;
}
