import type {
  ExtractResolversResult,
  GraphQLFieldDefinition,
  GraphQLInputValue,
} from "../resolver-extractor/index.js";

export type ResolverType = "query" | "mutation" | "field" | "subscription";

export interface ResolverFieldInfo {
  readonly field: GraphQLFieldDefinition;
  readonly resolverType: ResolverType;
  readonly parentTypeName: string | null;
}

/**
 * Iterates over all resolver fields (query, mutation, field extensions) in a consistent manner.
 * This eliminates the repeated iteration pattern across multiple collector functions.
 */
export function forEachResolverField(
  resolversResult: ExtractResolversResult,
  visitor: (info: ResolverFieldInfo) => void,
): void {
  for (const field of resolversResult.queryFields.fields) {
    visitor({ field, resolverType: "query", parentTypeName: null });
  }

  for (const field of resolversResult.mutationFields.fields) {
    visitor({ field, resolverType: "mutation", parentTypeName: null });
  }

  for (const field of resolversResult.subscriptionFields.fields) {
    visitor({ field, resolverType: "subscription", parentTypeName: null });
  }

  for (const ext of resolversResult.typeExtensions) {
    for (const field of ext.fields) {
      visitor({
        field,
        resolverType: "field",
        parentTypeName: ext.targetTypeName,
      });
    }
  }
}

/**
 * Iterates over a resolver field's arguments, if it has any. Eliminates the
 * repeated `if (!field.args) return; for (const arg of field.args)` pattern
 * across the inline-object/enum/union collectors.
 */
export function forEachResolverArg(
  field: GraphQLFieldDefinition,
  visitor: (arg: GraphQLInputValue) => void,
): void {
  if (!field.args) return;
  for (const arg of field.args) {
    visitor(arg);
  }
}
