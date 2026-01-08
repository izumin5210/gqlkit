/**
 * Interface metadata detector.
 *
 * This module provides functions to detect interface metadata embedded
 * in TypeScript intersection types using the $gqlkitInterfaceMeta property,
 * and to extract implements declarations from types using $gqlkitTypeMeta.
 */

import ts from "typescript";

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
