import type {
  DirectiveArgumentValue,
  DirectiveInfo,
  PropertyDef,
  TSTypeReference,
} from "../../core/index.js";
import * as ts from "../../core/typescript.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";
import { detectDefaultValueMetadata } from "../../shared/default-value-detector.js";
import {
  detectDirectiveMetadata,
  hasDirectiveMetadata,
  unwrapDirectiveType,
} from "../../shared/directive-detector.js";
import { getSourceLocationFromNode } from "../../shared/source-location.js";
import { extractTsDocFromSymbol } from "../../shared/tsdoc-parser.js";
import {
  extractPropertySymbols,
  getDeclarations,
  hasUndefinedInType,
  isNullableUnion,
} from "../../shared/typescript-utils.js";

export type TypeConverter = (
  type: ts.Type,
  checker: CheckerLoader,
  typeNode: ts.TypeNode | undefined,
) => Promise<TSTypeReference>;

/**
 * Extracts inline object properties from a TypeScript type.
 *
 * @param type - The TypeScript type to extract properties from
 * @param checker - The TypeScript type checker
 * @param convertType - A function to convert TypeScript types to TSTypeReference
 * @returns An array of inline object property definitions
 */
export async function extractInlineObjectProperties(
  type: ts.Type,
  checker: CheckerLoader,
  convertType: TypeConverter,
): Promise<PropertyDef[]> {
  const properties: PropertyDef[] = [];
  const typeProperties = await extractPropertySymbols(type, checker);

  for (const prop of typeProperties) {
    const propName = prop.name;
    if (propName.startsWith(" $")) {
      continue;
    }

    const propType = await checker.getTypeOfSymbol(prop);
    const declarations = await getDeclarations(prop);
    const declaration = declarations?.[0];

    const optional = await hasUndefinedInType(propType);

    const tsdocInfo = await extractTsDocFromSymbol(prop, checker);

    let actualPropType = propType;
    let directives: ReadonlyArray<DirectiveInfo> | null = null;
    let directiveNullable = false;
    let defaultValue: DirectiveArgumentValue | null = null;

    if (await hasDirectiveMetadata(propType, checker)) {
      const directiveResult = await detectDirectiveMetadata(propType, checker);
      if (directiveResult.directives.length > 0) {
        directives = directiveResult.directives;
      }

      const defaultValueResult = await detectDefaultValueMetadata(
        propType,
        checker,
      );
      if (defaultValueResult.defaultValue) {
        defaultValue = defaultValueResult.defaultValue;
      }

      if (await isNullableUnion(propType)) {
        directiveNullable = true;
      }
      actualPropType = await unwrapDirectiveType(propType, checker);

      if (!directiveNullable && (await isNullableUnion(actualPropType))) {
        directiveNullable = true;
      }
    }

    // Extract typeNode from property declaration to preserve type alias information.
    // checker.getTypeOfSymbol() can lose aliasSymbol for intersection types
    // (e.g., GqlObject<T, Meta> = T & { ... } may flatten to just T),
    // so passing the typeNode allows resolveFieldTypeInternal to recover
    // the original type reference via TypeReferenceNode.
    let propTypeNode: ts.TypeNode | undefined;
    if (
      declaration &&
      ts.isPropertySignatureDeclaration(declaration) &&
      declaration.type
    ) {
      propTypeNode = declaration.type;
    }

    const tsType = await convertType(actualPropType, checker, propTypeNode);
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
