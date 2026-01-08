/**
 * Interface metadata detector.
 *
 * This module provides functions to detect interface metadata embedded
 * in TypeScript intersection types using the $gqlkitInterfaceMeta property,
 * and to extract implements declarations from types using $gqlkitTypeMeta.
 */

import ts from "typescript";
import { getActualMetadataType } from "./metadata-detector.js";

const INTERFACE_METADATA_PROPERTY = " $gqlkitInterfaceMeta";
const TYPE_METADATA_PROPERTY = " $gqlkitTypeMeta";

/**
 * Result of interface type detection.
 */
export interface InterfaceDetectionResult {
  readonly isInterface: boolean;
  readonly implementedInterfaces: ReadonlyArray<string>;
}

/**
 * Checks if a type alias declaration uses DefineInterface.
 * Inspects the typeNode directly since TypeScript resolves the alias.
 */
export function isDefineInterfaceTypeAlias(
  node: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
): boolean {
  const typeNode = node.type;
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName.getText(sourceFile);
    return typeName === "DefineInterface";
  }
  return false;
}

/**
 * Extracts implements from DefineInterface type alias.
 */
export function extractImplementsFromDefineInterface(
  node: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ReadonlyArray<string> {
  const typeNode = node.type;
  if (!ts.isTypeReferenceNode(typeNode)) {
    return [];
  }

  const typeArgs = typeNode.typeArguments;
  if (!typeArgs || typeArgs.length < 2) {
    return [];
  }

  const metaArg = typeArgs[1];
  if (!metaArg || !ts.isTypeLiteralNode(metaArg)) {
    return [];
  }

  return extractImplementsFromTypeLiteral(metaArg, sourceFile, checker);
}

/**
 * Extracts implements from GqlTypeDef type alias.
 */
export function extractImplementsFromGqlTypeDef(
  node: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ReadonlyArray<string> {
  const typeNode = node.type;
  if (!ts.isTypeReferenceNode(typeNode)) {
    return [];
  }

  const typeName = typeNode.typeName.getText(sourceFile);
  if (typeName !== "GqlTypeDef") {
    return [];
  }

  const typeArgs = typeNode.typeArguments;
  if (!typeArgs || typeArgs.length < 2) {
    return [];
  }

  const metaArg = typeArgs[1];
  if (!metaArg || !ts.isTypeLiteralNode(metaArg)) {
    return [];
  }

  return extractImplementsFromTypeLiteral(metaArg, sourceFile, checker);
}

function extractImplementsFromTypeLiteral(
  typeLiteral: ts.TypeLiteralNode,
  sourceFile: ts.SourceFile,
  _checker: ts.TypeChecker,
): ReadonlyArray<string> {
  for (const member of typeLiteral.members) {
    if (ts.isPropertySignature(member) && member.name) {
      const propName = member.name.getText(sourceFile);
      if (propName === "implements" && member.type) {
        return extractInterfaceNamesFromTupleNode(member.type, sourceFile);
      }
    }
  }
  return [];
}

function extractInterfaceNamesFromTupleNode(
  typeNode: ts.TypeNode,
  sourceFile: ts.SourceFile,
): ReadonlyArray<string> {
  if (ts.isTupleTypeNode(typeNode)) {
    return typeNode.elements
      .map((elem) => {
        if (ts.isTypeReferenceNode(elem)) {
          return elem.typeName.getText(sourceFile);
        }
        return null;
      })
      .filter((name): name is string => name !== null);
  }

  if (
    ts.isArrayTypeNode(typeNode) &&
    ts.isTypeReferenceNode(typeNode.elementType)
  ) {
    return [typeNode.elementType.typeName.getText(sourceFile)];
  }

  return [];
}

/**
 * Checks if a type is a GraphQL interface type (uses DefineInterface).
 */
function isGraphQLInterfaceType(
  type: ts.Type,
  checker: ts.TypeChecker,
): boolean {
  if (type.aliasSymbol) {
    const aliasName = type.aliasSymbol.getName();
    if (aliasName === "DefineInterface") {
      return true;
    }
  }

  const metadataProp = type.getProperty(INTERFACE_METADATA_PROPERTY);
  if (!metadataProp) {
    return false;
  }

  const rawMetadataType = checker.getTypeOfSymbol(metadataProp);
  const metadataType = getActualMetadataType(rawMetadataType);
  if (!metadataType) {
    return false;
  }

  const interfaceMarker = metadataType.getProperty(" $gqlkitInterface");
  if (!interfaceMarker) {
    return false;
  }

  const markerType = checker.getTypeOfSymbol(interfaceMarker);
  const actualMarkerType = getActualMetadataType(markerType);

  if (
    actualMarkerType &&
    actualMarkerType.flags & ts.TypeFlags.BooleanLiteral
  ) {
    const typeStr = checker.typeToString(actualMarkerType);
    return typeStr === "true";
  }

  return false;
}

/**
 * Extracts implemented interfaces from a type's metadata.
 * Works for both DefineInterface (interface inheritance) and GqlTypeDef (type implements).
 */
function extractImplementedInterfaces(
  type: ts.Type,
  checker: ts.TypeChecker,
): ReadonlyArray<string> {
  const result: string[] = [];

  const interfaceMetaProp = type.getProperty(INTERFACE_METADATA_PROPERTY);
  if (interfaceMetaProp) {
    const interfaces = extractImplementsFromMetadata(
      interfaceMetaProp,
      checker,
    );
    result.push(...interfaces);
  }

  const typeMetaProp = type.getProperty(TYPE_METADATA_PROPERTY);
  if (typeMetaProp) {
    const interfaces = extractImplementsFromMetadata(typeMetaProp, checker);
    result.push(...interfaces);
  }

  return result;
}

function extractImplementsFromMetadata(
  metadataProp: ts.Symbol,
  checker: ts.TypeChecker,
): ReadonlyArray<string> {
  const rawMetadataType = checker.getTypeOfSymbol(metadataProp);
  const metadataType = getActualMetadataType(rawMetadataType);
  if (!metadataType) {
    return [];
  }

  const implementsProp = metadataType.getProperty("implements");
  if (!implementsProp) {
    return [];
  }

  const rawImplementsType = checker.getTypeOfSymbol(implementsProp);
  const implementsType = getActualMetadataType(rawImplementsType);
  if (!implementsType) {
    return [];
  }

  return extractInterfaceNamesFromTupleType(implementsType, checker);
}

function extractInterfaceNamesFromTupleType(
  type: ts.Type,
  checker: ts.TypeChecker,
): ReadonlyArray<string> {
  const result: string[] = [];

  if (checker.isTupleType(type)) {
    const tupleType = type as ts.TypeReference;
    const typeArgs =
      tupleType.typeArguments ?? checker.getTypeArguments(tupleType);

    for (const typeArg of typeArgs) {
      const name = extractInterfaceNameFromType(typeArg, checker);
      if (name) {
        result.push(name);
      }
    }
  } else if (type.isUnion()) {
    for (const member of type.types) {
      if (member.flags & ts.TypeFlags.Undefined) continue;
      const name = extractInterfaceNameFromType(member, checker);
      if (name) {
        result.push(name);
      }
    }
  }

  return result;
}

function extractInterfaceNameFromType(
  type: ts.Type,
  checker: ts.TypeChecker,
): string | null {
  if (isGraphQLInterfaceType(type, checker)) {
    const symbol = type.aliasSymbol ?? type.getSymbol();
    if (symbol) {
      return symbol.getName();
    }
  }

  const symbol = type.aliasSymbol ?? type.getSymbol();
  if (symbol) {
    const resolvedType = checker.getDeclaredTypeOfSymbol(symbol);
    if (resolvedType && isGraphQLInterfaceType(resolvedType, checker)) {
      return symbol.getName();
    }
  }

  return null;
}

/**
 * Detects interface metadata from a TypeScript type.
 */
function detectInterfaceMetadata(
  type: ts.Type,
  checker: ts.TypeChecker,
): InterfaceDetectionResult {
  const isInterface = isGraphQLInterfaceType(type, checker);
  const implementedInterfaces = extractImplementedInterfaces(type, checker);

  return {
    isInterface,
    implementedInterfaces,
  };
}
