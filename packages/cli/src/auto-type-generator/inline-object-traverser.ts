import type { InlineObjectPropertyDef } from "../type-extractor/types/index.js";

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

  for (const prop of properties) {
    const propPath = [...parentPath, prop.name];

    visitor(prop, propPath);

    if (
      prop.tsType.kind === "inlineObject" &&
      prop.tsType.inlineObjectProperties
    ) {
      traverseInlineObjectProperties(
        {
          properties: prop.tsType.inlineObjectProperties,
          parentPath: propPath,
        },
        visitor,
      );
    }
  }
}
