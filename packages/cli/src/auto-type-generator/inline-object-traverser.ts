import type {
  PropertyDef,
  SourceLocation,
  TSTypeReference,
} from "../core/index.js";
import { appendFieldPath } from "./naming-convention.js";

/**
 * A single node visited while walking an inline-object property tree.
 */
export interface InlineObjectVisitNode {
  readonly prop: PropertyDef;
  /** Full path from the traversal root to this property (including its own name). */
  readonly propPath: ReadonlyArray<string>;
  /**
   * `prop.sourceLocation`, falling back to the nearest ancestor's resolved
   * location (ultimately `defaultSourceLocation` from the top-level call)
   * when the property itself carries no location of its own.
   */
  readonly resolvedSourceLocation: SourceLocation;
}

export type PropertyVisitor = (node: InlineObjectVisitNode) => void;

export interface TraverseInlineObjectPropertiesParams {
  readonly properties: ReadonlyArray<PropertyDef>;
  readonly parentPath: ReadonlyArray<string>;
  readonly defaultSourceLocation: SourceLocation;
}

export function getInlineObjectPropertiesFromType(
  tsType: TSTypeReference,
): ReadonlyArray<PropertyDef> | null {
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
 * This is the single shared walk behind every inline-object/enum/union
 * collector (`inline-object-collector.ts`, `inline-enum-collector.ts`,
 * `inline-union-collector.ts`): each feature supplies its own visitor and
 * decides, per visited node, whether `node.prop.tsType` matches what it's
 * looking for. Recursion — which nodes have children to descend into — is
 * driven entirely by `getInlineObjectPropertiesFromType`, independent of what
 * any particular visitor does with a node.
 */
export function traverseInlineObjectProperties(
  params: TraverseInlineObjectPropertiesParams,
  visitor: PropertyVisitor,
): void {
  const { properties, parentPath, defaultSourceLocation } = params;
  const siblingFieldNames = new Set(properties.map((prop) => prop.name));

  for (const prop of properties) {
    const propPath = appendFieldPath({
      parentPath,
      fieldName: prop.name,
      singularize: prop.tsType.kind === "array",
      siblingFieldNames,
    });
    const resolvedSourceLocation = prop.sourceLocation ?? defaultSourceLocation;

    visitor({ prop, propPath, resolvedSourceLocation });

    const nestedProperties = getInlineObjectPropertiesFromType(prop.tsType);
    if (nestedProperties) {
      traverseInlineObjectProperties(
        {
          properties: nestedProperties,
          parentPath: propPath,
          defaultSourceLocation: resolvedSourceLocation,
        },
        visitor,
      );
    }
  }
}
