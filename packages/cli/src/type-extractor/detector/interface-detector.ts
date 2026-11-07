/**
 * Interface metadata detector.
 *
 * This module provides functions to detect interface metadata embedded
 * in TypeScript intersection types using the $gqlkitInterfaceMeta property,
 * and to extract implements declarations from types using $gqlkitTypeMeta.
 */

import type {
  SourceFile,
  TypeAliasDeclaration,
  TypeLiteralNode,
  TypeNode,
} from "typescript/ast";
import {
  isArrayTypeNode,
  isPropertySignatureDeclaration,
  isTupleTypeNode,
  isTypeLiteralNode,
  isTypeReferenceNode,
} from "typescript/ast/is";
import type { Type } from "typescript/async";
import { METADATA_PROPERTIES } from "../../core/index.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";
import { findMetadataProperty } from "../../shared/typescript-utils.js";

const INTERFACE_META_PROPERTY = METADATA_PROPERTIES.INTERFACE_META;
const TYPE_META_PROPERTY = METADATA_PROPERTIES.TYPE_META;

/**
 * Checks if a type alias declaration uses GqlInterface.
 * Detects by checking for the $gqlkitInterfaceMeta property in the resolved type.
 */
export async function isDefineInterfaceTypeAlias(
  node: TypeAliasDeclaration,
  checker: CheckerLoader,
): Promise<boolean> {
  const symbol = await checker.getSymbolAtLocation(node.name);
  if (!symbol) {
    return false;
  }

  const type = await checker.getDeclaredTypeOfSymbol(symbol);
  return hasInterfaceMetadata(type, checker);
}

/**
 * Checks if a type has the $gqlkitInterfaceMeta property.
 */
async function hasInterfaceMetadata(
  type: Type,
  checker: CheckerLoader,
): Promise<boolean> {
  return (
    (await findMetadataProperty({
      checker,
      type,
      propertyNames: [INTERFACE_META_PROPERTY],
      recurseUnion: false,
    })) !== undefined
  );
}

/**
 * Checks if a type has the $gqlkitTypeMeta property (GqlObject).
 */
async function hasTypeMetadata(
  type: Type,
  checker: CheckerLoader,
): Promise<boolean> {
  return (
    (await findMetadataProperty({
      checker,
      type,
      propertyNames: [TYPE_META_PROPERTY],
      recurseUnion: false,
    })) !== undefined
  );
}

/**
 * Extracts implements from GqlInterface type alias.
 */
export function extractImplementsFromDefineInterface(
  node: TypeAliasDeclaration,
  sourceFile: SourceFile,
  checker: CheckerLoader,
): ReadonlyArray<string> {
  const typeNode = node.type;
  if (!isTypeReferenceNode(typeNode)) {
    return [];
  }

  const typeArgs = typeNode.typeArguments;
  if (!typeArgs || typeArgs.length < 2) {
    return [];
  }

  const metaArg = typeArgs[1];
  if (!metaArg || !isTypeLiteralNode(metaArg)) {
    return [];
  }

  return extractImplementsFromTypeLiteral(metaArg, sourceFile, checker);
}

/**
 * Extracts implements from GqlObject type alias.
 * Detects GqlObject by checking for the $gqlkitTypeMeta property in the resolved type.
 */
export async function extractImplementsFromGqlTypeDef(
  node: TypeAliasDeclaration,
  sourceFile: SourceFile,
  checker: CheckerLoader,
): Promise<ReadonlyArray<string>> {
  const symbol = await checker.getSymbolAtLocation(node.name);
  if (!symbol) {
    return [];
  }

  const type = await checker.getDeclaredTypeOfSymbol(symbol);
  if (!(await hasTypeMetadata(type, checker))) {
    return [];
  }

  const typeNode = node.type;
  if (!isTypeReferenceNode(typeNode)) {
    return [];
  }

  const typeArgs = typeNode.typeArguments;
  if (!typeArgs || typeArgs.length < 2) {
    return [];
  }

  const metaArg = typeArgs[1];
  if (!metaArg || !isTypeLiteralNode(metaArg)) {
    return [];
  }

  return extractImplementsFromTypeLiteral(metaArg, sourceFile, checker);
}

function extractImplementsFromTypeLiteral(
  typeLiteral: TypeLiteralNode,
  sourceFile: SourceFile,
  _checker: CheckerLoader,
): ReadonlyArray<string> {
  for (const member of typeLiteral.members) {
    if (isPropertySignatureDeclaration(member) && member.name) {
      const propName = member.name.getText(sourceFile);
      if (propName === "implements" && member.type) {
        return extractInterfaceNamesFromTupleNode(member.type, sourceFile);
      }
    }
  }
  return [];
}

function extractInterfaceNamesFromTupleNode(
  typeNode: TypeNode,
  sourceFile: SourceFile,
): ReadonlyArray<string> {
  if (isTupleTypeNode(typeNode)) {
    return typeNode.elements
      .map((elem) => {
        if (isTypeReferenceNode(elem)) {
          return elem.typeName.getText(sourceFile);
        }
        return null;
      })
      .filter((name): name is string => name !== null);
  }

  if (isArrayTypeNode(typeNode) && isTypeReferenceNode(typeNode.elementType)) {
    return [typeNode.elementType.typeName.getText(sourceFile)];
  }

  return [];
}
