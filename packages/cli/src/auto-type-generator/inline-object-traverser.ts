import type {
  InlineObjectPropertyDef,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import { appendFieldPath } from "./naming-convention.js";

/**
 * Visitor callback for each property in an inline object hierarchy.
 * @param prop The property being visited
 * @param propPath Full path from the root to this property (including the property name)
 */
export type PropertyVisitor = (
  prop: InlineObjectPropertyDef,
  propPath: ReadonlyArray<string>,
) => void;

export interface TraverseInlineObjectPropertiesParams {
  readonly properties: ReadonlyArray<InlineObjectPropertyDef>;
  readonly parentPath: ReadonlyArray<string>;
}

export function getInlineObjectPropertiesFromType(
  tsType: TSTypeReference,
): ReadonlyArray<InlineObjectPropertyDef> | null {
  if (tsType.kind === "inlineObject" && tsType.inlineObjectProperties) {
    return tsType.inlineObjectProperties;
  }

  if (
    tsType.kind === "array" &&
    tsType.elementType?.kind === "inlineObject" &&
    tsType.elementType.inlineObjectProperties
  ) {
    return tsType.elementType.inlineObjectProperties;
  }

  return null;
}

/**
 * Traverses inline object properties recursively, calling the visitor for each property.
 * Handles nested inlineObject properties automatically.
 *
 * This utility eliminates the duplicated traversal logic in inline-enum-collector
 * and inline-union-collector.
 */
export function traverseInlineObjectProperties(
  params: TraverseInlineObjectPropertiesParams,
  visitor: PropertyVisitor,
): void {
  const { properties, parentPath } = params;
  const siblingFieldNames = new Set(properties.map((prop) => prop.name));

  for (const prop of properties) {
    const propPath = appendFieldPath({
      parentPath,
      fieldName: prop.name,
      singularize: prop.tsType.kind === "array",
      siblingFieldNames,
    });

    visitor(prop, propPath);

    const nestedProperties = getInlineObjectPropertiesFromType(prop.tsType);
    if (nestedProperties) {
      traverseInlineObjectProperties(
        {
          properties: nestedProperties,
          parentPath: propPath,
        },
        visitor,
      );
    }
  }
}
