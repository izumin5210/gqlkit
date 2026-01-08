/**
 * Scalar metadata detector.
 *
 * This module provides functions to detect scalar metadata embedded
 * in TypeScript intersection types using the $gqlkitScalar property.
 */

import ts from "typescript";

const SCALAR_METADATA_PROPERTY = " $gqlkitScalar";

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
  readonly error: ScalarMetadataError | undefined;
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
    error: undefined,
  };
}

/**
 * Extracts the actual type from an optional property type (T | undefined).
 * Used by both scalar and resolver metadata detection.
 *
 * For simple cases like `T | undefined`, returns T.
 * For union cases like `T | null | undefined`, returns the original union type
 * so the caller can analyze it (e.g., check for null members).
 *
 * @param metadataType - The type of the metadata property (may be union with undefined)
 * @returns The actual type excluding undefined, or null if extraction fails
 */
export function getActualMetadataType(metadataType: ts.Type): ts.Type | null {
  if (metadataType.isUnion()) {
    const nonUndefinedTypes = metadataType.types.filter(
      (t) => !(t.flags & ts.TypeFlags.Undefined),
    );
    if (nonUndefinedTypes.length === 1) {
      return nonUndefinedTypes[0]!;
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

function extractMetadataFromType(
  type: ts.Type,
  checker: ts.TypeChecker,
): InternalMetadata | null {
  const metadataProp = type.getProperty(SCALAR_METADATA_PROPERTY);
  if (!metadataProp) {
    return null;
  }

  const rawMetadataType = checker.getTypeOfSymbol(metadataProp);
  const metadataType = getActualMetadataType(rawMetadataType);
  if (!metadataType) {
    return null;
  }

  const nameProp = metadataType.getProperty("name");
  if (!nameProp) {
    return null;
  }

  const nameType = checker.getTypeOfSymbol(nameProp);
  if (!(nameType.flags & ts.TypeFlags.StringLiteral)) {
    return null;
  }

  const scalarName = (nameType as ts.StringLiteralType).value;

  const onlyProp = metadataType.getProperty("only");
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
  checker: ts.TypeChecker,
): InternalMetadata | null {
  if (!type.isIntersection()) {
    return null;
  }

  for (const member of type.types) {
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

function isNullOrUndefined(type: ts.Type): boolean {
  return !!(
    type.flags & ts.TypeFlags.Null || type.flags & ts.TypeFlags.Undefined
  );
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
  checker: ts.TypeChecker,
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

  if (type.aliasSymbol) {
    const aliasedType = checker.getDeclaredTypeOfSymbol(type.aliasSymbol);
    if (aliasedType !== type) {
      const aliasResult = detectScalarMetadataCore(aliasedType, checker);
      if (aliasResult) {
        return aliasResult;
      }
    }
  }

  const symbol = type.getSymbol();
  if (symbol) {
    const declarations = symbol.getDeclarations();
    if (declarations && declarations.length > 0) {
      for (const decl of declarations) {
        if (ts.isTypeAliasDeclaration(decl)) {
          const declSymbol = checker.getSymbolAtLocation(decl.name);
          if (declSymbol) {
            const declType = checker.getDeclaredTypeOfSymbol(declSymbol);
            if (declType !== type && declType.isIntersection()) {
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
        properties[0]?.getName() === SCALAR_METADATA_PROPERTY;

      if (!hasOnlyMetadataProperty && properties.length > 0) {
        const metadataProp = type.getProperty(SCALAR_METADATA_PROPERTY);
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
  checker: ts.TypeChecker,
): ScalarMetadataResult {
  const result = createDefaultResult();

  if (checker.isArrayType(type)) {
    const typeRef = type as ts.TypeReference;
    const elementType = typeRef.typeArguments?.[0];

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

  if (type.isUnion()) {
    const nonNullTypes = type.types.filter((t) => !isNullOrUndefined(t));
    const hasNull = type.types.some((t) => isNullOrUndefined(t));

    if (isBooleanLiteralUnion(type.types)) {
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
