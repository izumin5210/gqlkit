import ts from "typescript";
import type {
  InlineObjectPropertyDef,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import { detectDefaultValueMetadata } from "./default-value-detector.js";
import {
  type DirectiveArgumentValue,
  type DirectiveInfo,
  detectDirectiveMetadata,
  hasDirectiveMetadata,
  unwrapDirectiveType,
} from "./directive-detector.js";
import { getSourceLocationFromNode } from "./source-location.js";
import { extractTsDocFromSymbol } from "./tsdoc-parser.js";
import { isNullableUnion } from "./typescript-utils.js";

export type TypeConverter = (
  type: ts.Type,
  checker: ts.TypeChecker,
) => TSTypeReference;

/**
 * Extracts property symbols from a type, handling intersection types
 * and falling back to getApparentType when getProperties() returns empty.
 *
 * This follows the same pattern as extractPropertiesFromType in type-extractor.ts.
 */
function extractPropertySymbols(
  type: ts.Type,
  checker: ts.TypeChecker,
): ts.Symbol[] {
  if (type.isIntersection()) {
    const allProps = new Map<string, ts.Symbol>();
    for (const member of type.types) {
      const memberProps = member.getProperties();
      for (const prop of memberProps) {
        const propName = prop.getName();
        if (!allProps.has(propName)) {
          allProps.set(propName, prop);
        }
      }
    }
    return [...allProps.values()];
  }

  const properties = type.getProperties();
  if (properties.length > 0) {
    return [...properties];
  }

  const apparentType = checker.getApparentType(type);
  if (apparentType !== type) {
    return [...apparentType.getProperties()];
  }

  return [];
}

/**
 * Extracts inline object properties from a TypeScript type.
 *
 * @param type - The TypeScript type to extract properties from
 * @param checker - The TypeScript type checker
 * @param convertType - A function to convert TypeScript types to TSTypeReference
 * @returns An array of inline object property definitions
 */
export function extractInlineObjectProperties(
  type: ts.Type,
  checker: ts.TypeChecker,
  convertType: TypeConverter,
): InlineObjectPropertyDef[] {
  const properties: InlineObjectPropertyDef[] = [];
  const typeProperties = extractPropertySymbols(type, checker);

  for (const prop of typeProperties) {
    const propName = prop.getName();
    if (propName.startsWith(" $")) {
      continue;
    }

    const propType = checker.getTypeOfSymbol(prop);
    const declarations = prop.getDeclarations();
    const declaration = declarations?.[0];

    let optional = false;
    if (declaration && ts.isPropertySignature(declaration)) {
      optional = declaration.questionToken !== undefined;
    }

    const tsdocInfo = extractTsDocFromSymbol(prop, checker);

    let actualPropType = propType;
    let directives: ReadonlyArray<DirectiveInfo> | null = null;
    let directiveNullable = false;
    let defaultValue: DirectiveArgumentValue | null = null;

    if (hasDirectiveMetadata(propType)) {
      const directiveResult = detectDirectiveMetadata(propType, checker);
      if (directiveResult.directives.length > 0) {
        directives = directiveResult.directives;
      }

      const defaultValueResult = detectDefaultValueMetadata(propType, checker);
      if (defaultValueResult.defaultValue) {
        defaultValue = defaultValueResult.defaultValue;
      }

      if (isNullableUnion(propType)) {
        directiveNullable = true;
      }
      actualPropType = unwrapDirectiveType(propType, checker);

      if (!directiveNullable && isNullableUnion(actualPropType)) {
        directiveNullable = true;
      }
    }

    const tsType = convertType(actualPropType, checker);
    const finalTsType =
      directiveNullable && !tsType.nullable
        ? { ...tsType, nullable: true }
        : tsType;

    properties.push({
      name: propName,
      tsType: finalTsType,
      optional,
      description: tsdocInfo.description ?? null,
      deprecated: tsdocInfo.deprecated ?? null,
      directives,
      defaultValue,
      sourceLocation: getSourceLocationFromNode(declaration),
    });
  }

  return properties;
}
