/**
 * Scalar metadata detector.
 *
 * This module provides functions to detect scalar metadata from TypeScript types
 * using the intersection type pattern with " $gqlkitScalar" property.
 */

import ts from "typescript";
import type { Diagnostic } from "../type-extractor/types/index.js";
import { extractTSDocFromSymbol } from "./tsdoc-parser.js";

const SCALAR_METADATA_KEY = " $gqlkitScalar";

/**
 * Information about a detected scalar type from metadata.
 */
export interface ScalarMetadataInfo {
  /** The GraphQL scalar type name (e.g., "ID", "Int", "DateTime") */
  readonly scalarName: string;
  /** The TypeScript type name (e.g., "IDString", "MyDateTime") */
  readonly typeName: string | null;
  /** Usage constraint: "input", "output", or null for both */
  readonly only: "input" | "output" | null;
  /** Source file where the type is defined */
  readonly sourceFile: string | null;
  /** Line number in the source file */
  readonly line: number | null;
  /** TSDoc description */
  readonly description: string | null;
}

/**
 * Result of scalar metadata detection.
 */
export interface DetectionResult {
  /** The scalar info if detected, null if not a scalar type */
  readonly scalarInfo: ScalarMetadataInfo | null;
  /** Any diagnostics generated during detection */
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

/**
 * Checks if a type has the $gqlkitScalar metadata property.
 */
function hasScalarMetadataProperty(type: ts.Type): boolean {
  const properties = type.getProperties();
  return properties.some((prop) => prop.getName() === SCALAR_METADATA_KEY);
}

/**
 * Gets the non-undefined type from a potentially undefined union.
 */
function getNonUndefinedType(type: ts.Type): ts.Type | null {
  if (type.isUnion()) {
    const nonUndefined = type.types.filter(
      (t) => !(t.flags & ts.TypeFlags.Undefined),
    );
    if (nonUndefined.length === 1) {
      return nonUndefined[0]!;
    }
    if (nonUndefined.length > 1) {
      return type;
    }
    return null;
  }
  return type;
}

/**
 * Extracts scalar metadata from a type's " $gqlkitScalar" property.
 */
function extractMetadataFromProperty(
  type: ts.Type,
  checker: ts.TypeChecker,
): { name: string; only: "input" | "output" | null } | null {
  const metadataProp = type.getProperty(SCALAR_METADATA_KEY);
  if (!metadataProp) {
    return null;
  }

  let metadataType = checker.getTypeOfSymbol(metadataProp);

  metadataType = getNonUndefinedType(metadataType) ?? metadataType;

  const nameProp = metadataType.getProperty("name");
  if (!nameProp) {
    return null;
  }

  const nameType = checker.getTypeOfSymbol(nameProp);
  if (!(nameType.flags & ts.TypeFlags.StringLiteral)) {
    return null;
  }

  const scalarName = checker.typeToString(nameType).replace(/^"|"$/g, "");

  let only: "input" | "output" | null = null;
  const onlyProp = metadataType.getProperty("only");
  if (onlyProp) {
    const onlyType = checker.getTypeOfSymbol(onlyProp);
    const onlyValue = checker.typeToString(onlyType).replace(/^"|"$/g, "");
    if (onlyValue === "input" || onlyValue === "output") {
      only = onlyValue;
    }
  }

  return { name: scalarName, only };
}

/**
 * Gets the TypeScript type name if available.
 */
function getTypeName(type: ts.Type): string | null {
  if (type.aliasSymbol) {
    return type.aliasSymbol.getName();
  }
  if (type.symbol) {
    return type.symbol.getName();
  }
  return null;
}

/**
 * Gets source location information for a type.
 */
function getSourceLocation(
  type: ts.Type,
): { sourceFile: string; line: number } | null {
  const symbol = type.aliasSymbol ?? type.symbol;
  if (!symbol) {
    return null;
  }

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return null;
  }

  const declaration = declarations[0]!;
  const sourceFile = declaration.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(
    declaration.getStart(),
  );

  return {
    sourceFile: sourceFile.fileName,
    line: line + 1,
  };
}

/**
 * Checks if a type is a primitive TypeScript type and returns its GraphQL mapping.
 */
function detectPrimitiveScalar(type: ts.Type): ScalarMetadataInfo | null {
  if (type.flags & ts.TypeFlags.String) {
    return {
      scalarName: "String",
      typeName: null,
      only: null,
      sourceFile: null,
      line: null,
      description: null,
    };
  }

  if (type.flags & ts.TypeFlags.Number) {
    return {
      scalarName: "Float",
      typeName: null,
      only: null,
      sourceFile: null,
      line: null,
      description: null,
    };
  }

  if (type.flags & ts.TypeFlags.Boolean) {
    return {
      scalarName: "Boolean",
      typeName: null,
      only: null,
      sourceFile: null,
      line: null,
      description: null,
    };
  }

  if (type.flags & ts.TypeFlags.BooleanLiteral) {
    return {
      scalarName: "Boolean",
      typeName: null,
      only: null,
      sourceFile: null,
      line: null,
      description: null,
    };
  }

  return null;
}

/**
 * Extracts TSDoc description from a type's symbol.
 */
function extractDescription(
  type: ts.Type,
  checker: ts.TypeChecker,
): string | null {
  const symbol = type.aliasSymbol ?? type.symbol;
  if (!symbol) {
    return null;
  }

  const tsDocInfo = extractTSDocFromSymbol(symbol, checker);
  return tsDocInfo.description;
}

/**
 * Attempts to detect scalar metadata from a single type (non-union).
 */
function detectScalarFromSingleType(
  type: ts.Type,
  checker: ts.TypeChecker,
  visited: Set<ts.Type> = new Set(),
): ScalarMetadataInfo | null {
  if (visited.has(type)) {
    return null;
  }
  visited.add(type);

  if (hasScalarMetadataProperty(type)) {
    const metadata = extractMetadataFromProperty(type, checker);
    if (metadata) {
      const location = getSourceLocation(type);
      const description = extractDescription(type, checker);
      return {
        scalarName: metadata.name,
        typeName: getTypeName(type),
        only: metadata.only,
        sourceFile: location?.sourceFile ?? null,
        line: location?.line ?? null,
        description,
      };
    }
  }

  if (type.isIntersection()) {
    for (const member of type.types) {
      if (hasScalarMetadataProperty(member)) {
        const metadata = extractMetadataFromProperty(member, checker);
        if (metadata) {
          const location = getSourceLocation(type);
          const description = extractDescription(type, checker);
          return {
            scalarName: metadata.name,
            typeName: getTypeName(type),
            only: metadata.only,
            sourceFile: location?.sourceFile ?? null,
            line: location?.line ?? null,
            description,
          };
        }
      }
    }

    for (const member of type.types) {
      const result = detectScalarFromSingleType(member, checker, visited);
      if (result) {
        return result;
      }
    }
  }

  if (type.aliasSymbol) {
    const aliasDeclarations = type.aliasSymbol.getDeclarations();
    if (aliasDeclarations && aliasDeclarations.length > 0) {
      const declaration = aliasDeclarations[0];
      if (declaration && ts.isTypeAliasDeclaration(declaration)) {
        const aliasedType = checker.getTypeFromTypeNode(declaration.type);
        const result = detectScalarFromSingleType(
          aliasedType,
          checker,
          visited,
        );
        if (result) {
          const location = getSourceLocation(type);
          const description = extractDescription(type, checker);
          return {
            ...result,
            typeName: getTypeName(type),
            sourceFile: location?.sourceFile ?? result.sourceFile,
            line: location?.line ?? result.line,
            description: description ?? result.description,
          };
        }
      }
    }
  }

  const primitiveResult = detectPrimitiveScalar(type);
  if (primitiveResult) {
    return primitiveResult;
  }

  return null;
}

/**
 * Filters out null and undefined types from a union.
 */
function getNonNullableTypes(type: ts.Type): ts.Type[] {
  if (!type.isUnion()) {
    return [type];
  }

  return type.types.filter(
    (t) =>
      !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined),
  );
}

/**
 * Detects scalar metadata from a TypeScript type.
 * Handles intersection types, unions with null, and type alias chains.
 *
 * @param type - The TypeScript type to analyze
 * @param checker - The TypeScript type checker
 * @returns Detection result with scalar info if found
 */
export function detectScalarMetadata(
  type: ts.Type,
  checker: ts.TypeChecker,
): DetectionResult {
  if (checker.isArrayType(type)) {
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
    if (typeArgs && typeArgs.length > 0) {
      const elementType = typeArgs[0]!;
      return detectScalarMetadata(elementType, checker);
    }
    return { scalarInfo: null, diagnostics: [] };
  }

  if (type.isUnion()) {
    const nonNullTypes = getNonNullableTypes(type);

    if (nonNullTypes.length === 0) {
      return { scalarInfo: null, diagnostics: [] };
    }

    if (nonNullTypes.length === 1) {
      return detectScalarMetadata(nonNullTypes[0]!, checker);
    }

    if (
      nonNullTypes.length === 2 &&
      nonNullTypes.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)
    ) {
      return {
        scalarInfo: {
          scalarName: "Boolean",
          typeName: null,
          only: null,
          sourceFile: null,
          line: null,
          description: null,
        },
        diagnostics: [],
      };
    }

    const firstResult = detectScalarFromSingleType(nonNullTypes[0]!, checker);
    if (!firstResult) {
      return { scalarInfo: null, diagnostics: [] };
    }

    for (let i = 1; i < nonNullTypes.length; i++) {
      const result = detectScalarFromSingleType(nonNullTypes[i]!, checker);
      if (!result || result.scalarName !== firstResult.scalarName) {
        return { scalarInfo: null, diagnostics: [] };
      }
    }

    return { scalarInfo: firstResult, diagnostics: [] };
  }

  const result = detectScalarFromSingleType(type, checker);
  return { scalarInfo: result, diagnostics: [] };
}

/**
 * Collects all scalar names from a union type.
 */
function collectScalarNamesFromUnion(
  type: ts.Type,
  checker: ts.TypeChecker,
): Set<string> {
  const scalarNames = new Set<string>();

  if (!type.isUnion()) {
    const result = detectScalarFromSingleType(type, checker);
    if (result) {
      scalarNames.add(result.scalarName);
    }
    return scalarNames;
  }

  const nonNullTypes = getNonNullableTypes(type);

  if (
    nonNullTypes.length === 2 &&
    nonNullTypes.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)
  ) {
    scalarNames.add("Boolean");
    return scalarNames;
  }

  for (const memberType of nonNullTypes) {
    const result = detectScalarFromSingleType(memberType, checker);
    if (result) {
      scalarNames.add(result.scalarName);
    }
  }

  return scalarNames;
}

/**
 * Validates that a union type does not contain different scalar types.
 * For example, `Int | IDString` is invalid because GraphQL cannot represent this.
 *
 * @param type - The TypeScript type to validate
 * @param checker - The TypeScript type checker
 * @returns Array of diagnostics for any mixed scalar union errors
 */
export function validateNoMixedScalarUnion(
  type: ts.Type,
  checker: ts.TypeChecker,
): ReadonlyArray<Diagnostic> {
  if (!type.isUnion()) {
    return [];
  }

  const scalarNames = collectScalarNamesFromUnion(type, checker);

  if (scalarNames.size > 1) {
    const sortedNames = [...scalarNames].sort();
    return [
      {
        code: "CONFLICTING_SCALAR_TYPE",
        message: `Union of different scalar types is not allowed: ${sortedNames.join(", ")}. GraphQL cannot represent this type.`,
        severity: "error",
        location: null,
      },
    ];
  }

  return [];
}
