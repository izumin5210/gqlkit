import type { AbstractResolverInfo } from "../resolver-extractor/index.js";
import type { ExtractedTypeInfo } from "../type-extractor/index.js";
import {
  type CollectDiscriminatorResolveTypesResult,
  collectDiscriminatorResolveTypes,
  type DiscriminatorResolveTypeInfo,
  type ValidatedDiscriminatorEntry,
} from "./discriminator-resolve-type-generator.js";
import type { InlineDiscriminatorResolveType } from "./intersection-flattener.js";
import {
  type CollectTypenameResolveTypesResult,
  collectTypenameResolveTypes,
} from "./typename-resolve-type-generator.js";

export interface CollectResolveTypesParams {
  readonly validatedEntries: ReadonlyArray<ValidatedDiscriminatorEntry>;
  readonly abstractTypeResolvers: ReadonlyArray<AbstractResolverInfo>;
  readonly extractedTypes: ReadonlyArray<ExtractedTypeInfo>;
  readonly typeMap: ReadonlyMap<string, ExtractedTypeInfo>;
  readonly inlineDiscriminatorResolveTypes: ReadonlyArray<InlineDiscriminatorResolveType>;
  /** Union names that have discriminatorFields configured; these are excluded from typename processing. */
  readonly discriminatorFieldUnionNames: ReadonlySet<string>;
}

export interface CollectResolveTypesResult {
  readonly discriminatorResolveTypesResult: CollectDiscriminatorResolveTypesResult;
  readonly mergedDiscriminatorResolveTypes: ReadonlyArray<DiscriminatorResolveTypeInfo>;
  readonly typenameResolveTypesResult: CollectTypenameResolveTypesResult;
}

/**
 * Sequences the two independent resolveType pipelines (discriminator-based and
 * typename-based) behind a single entry point, so callers no longer have to
 * hand-derive the suppression sets that keep the two calls consistent
 * (refactor-plan.md §3.2).
 */
export function collectResolveTypes(
  params: CollectResolveTypesParams,
): CollectResolveTypesResult {
  const {
    validatedEntries,
    abstractTypeResolvers,
    extractedTypes,
    typeMap,
    inlineDiscriminatorResolveTypes,
    discriminatorFieldUnionNames,
  } = params;

  const manualResolveTypeNames = new Set(
    abstractTypeResolvers
      .filter((r) => r.kind === "resolveType")
      .map((r) => r.targetTypeName),
  );

  // Collect discriminator resolve types from validated entries
  const discriminatorResolveTypesResult = collectDiscriminatorResolveTypes({
    validatedEntries,
    manualResolveTypeNames,
    extractedTypes,
    typeMap,
  });

  // Merge inline discriminator resolveTypes from auto-type generation
  // (for inline unions flattened by discriminator fields, e.g. UIMessagePart<...>[])
  const mergedDiscriminatorResolveTypes = [
    ...discriminatorResolveTypesResult.discriminatorResolveTypes,
    ...inlineDiscriminatorResolveTypes,
  ];
  // discriminatorResolveTypeNames are derived by integrate() from the merged list

  const typenameResolveTypesResult = collectTypenameResolveTypes({
    extractedTypes,
    typeMap,
    manualResolveTypeNames,
    discriminatorFieldUnionNames,
  });

  return {
    discriminatorResolveTypesResult,
    mergedDiscriminatorResolveTypes,
    typenameResolveTypesResult,
  };
}
