/**
 * Interface metadata detector.
 *
 * This module provides functions to detect interface metadata embedded
 * in TypeScript intersection types using the $gqlkitInterfaceMeta property,
 * and to extract implements declarations from types using $gqlkitTypeMeta.
 */

import ts from "typescript";
import { METADATA_PROPERTIES } from "./constants.js";

const INTERFACE_META_PROPERTY = METADATA_PROPERTIES.INTERFACE_META;
const TYPE_META_PROPERTY = METADATA_PROPERTIES.TYPE_META;

/**
 * Checks if a type alias declaration uses GqlInterface.
 * Detects by checking for the $gqlkitInterfaceMeta property in the resolved type.
 */
export function isDefineInterfaceTypeAlias(
  node: ts.TypeAliasDeclaration,
  checker: ts.TypeChecker,
): boolean {
  const symbol = checker.getSymbolAtLocation(node.name);
  if (!symbol) {
    return false;
  }

  const type = checker.getDeclaredTypeOfSymbol(symbol);
  return hasInterfaceMetadata(type);
}

/**
 * Checks if a type has the $gqlkitInterfaceMeta property.
 */
function hasInterfaceMetadata(type: ts.Type): boolean {
  const metaProp = type.getProperty(INTERFACE_META_PROPERTY);
  if (metaProp) {
    return true;
  }

  if (type.isIntersection()) {
    for (const member of type.types) {
      const prop = member.getProperty(INTERFACE_META_PROPERTY);
      if (prop) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if a type has the $gqlkitTypeMeta property (GqlObject).
 */
function hasTypeMetadata(type: ts.Type): boolean {
  const metaProp = type.getProperty(TYPE_META_PROPERTY);
  if (metaProp) {
    return true;
  }

  if (type.isIntersection()) {
    for (const member of type.types) {
      const prop = member.getProperty(TYPE_META_PROPERTY);
      if (prop) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extracts implements from GqlInterface type alias.
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
 * Extracts implements from GqlObject type alias.
 * Detects GqlObject by checking for the $gqlkitTypeMeta property in the resolved type.
 */
export function extractImplementsFromGqlTypeDef(
  node: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ReadonlyArray<string> {
  const symbol = checker.getSymbolAtLocation(node.name);
  if (!symbol) {
    return [];
  }

  const type = checker.getDeclaredTypeOfSymbol(symbol);
  if (!hasTypeMetadata(type)) {
    return [];
  }

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
