import type { TSTypeReference } from "../core/index.js";

/**
 * Which of the three per-context generated-name maps a `TSTypeReference`'s
 * unresolved inline type belongs to.
 */
export type GeneratedNameMapKind = "object" | "enum" | "union";

/**
 * Classifies a `TSTypeReference` (or its array element type) as carrying an
 * unresolved inline object/enum/union, without consulting any name map.
 *
 * This is the "is this tsType an inlineObject/inlineEnum/union, singular or
 * array-wrapped" half of the decision tree (refactor-plan.md §1.2-D);
 * `resolveGeneratedTypeName` below builds on it for the common case (look up
 * an already-generated name in one of the three persistent maps). It's
 * exported on its own for the one caller that needs the classification
 * without a map lookup: union-member resolution, which generates a name on
 * a cache miss instead of just reporting "not found".
 */
export function classifyInlineTypeReference(
  tsType: TSTypeReference,
): GeneratedNameMapKind | null {
  const target = tsType.kind === "array" ? tsType.elementType : tsType;
  if (!target) return null;

  if (target.kind === "inlineObject" && target.inlineObjectProperties) {
    return "object";
  }
  if (target.kind === "inlineEnum" && target.inlineEnumMembers) {
    return "enum";
  }
  if (target.kind === "union" && target.members) {
    return "union";
  }
  return null;
}

export interface GeneratedTypeNameMaps {
  readonly generatedTypeNames: ReadonlyMap<string, string>;
  readonly enumTypeNames: ReadonlyMap<string, string>;
  readonly unionTypeNames: ReadonlyMap<string, string>;
}

export interface ResolveGeneratedTypeNameParams {
  readonly tsType: TSTypeReference;
  readonly contextKey: string;
  readonly maps: GeneratedTypeNameMaps;
}

export interface ResolvedGeneratedTypeName {
  readonly mapKind: GeneratedNameMapKind;
  readonly name: string;
}

/**
 * The "which generated-name map does this contextKey live in" decision tree,
 * extracted to a single implementation (refactor-plan.md §1.2-D). Classifies
 * `tsType` (directly, or via its array element type) as an inline
 * object/enum/union, then looks up `contextKey` in the corresponding map.
 *
 * Returns null when `tsType` isn't an inline-type carrier, or when no name
 * has been generated yet for this context — the caller decides what that
 * means (e.g. leave the field/arg/payload untouched).
 */
export function resolveGeneratedTypeName(
  params: ResolveGeneratedTypeNameParams,
): ResolvedGeneratedTypeName | null {
  const { tsType, contextKey, maps } = params;
  const mapKind = classifyInlineTypeReference(tsType);
  if (!mapKind) return null;

  const map =
    mapKind === "object"
      ? maps.generatedTypeNames
      : mapKind === "enum"
        ? maps.enumTypeNames
        : maps.unionTypeNames;
  const name = map.get(contextKey);

  return name ? { mapKind, name } : null;
}
