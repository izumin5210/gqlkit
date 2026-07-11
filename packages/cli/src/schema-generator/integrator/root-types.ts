/**
 * Synthesizes the Query/Mutation/Subscription root types. The GraphQL spec
 * requires a Query root type to exist even when only Subscription/Mutation
 * resolvers are defined.
 */

import type { ExtractResolversResult } from "../../resolver-extractor/index.js";
import type { BaseType } from "./type-mapper.js";

export interface RootTypePresence {
  readonly hasQuery: boolean;
  readonly hasMutation: boolean;
  readonly hasSubscription: boolean;
}

export function detectRootTypePresence(
  resolversResult: ExtractResolversResult,
): RootTypePresence {
  return {
    hasQuery: resolversResult.queryFields.fields.length > 0,
    hasMutation: resolversResult.mutationFields.fields.length > 0,
    hasSubscription: resolversResult.subscriptionFields.fields.length > 0,
  };
}

function createRootType(name: "Query" | "Mutation" | "Subscription"): BaseType {
  return {
    name,
    kind: "Object",
    fields: [],
    unionMembers: null,
    enumValues: null,
    isNumericEnum: false,
    needsStringEnumMapping: false,
    implementedInterfaces: null,
    description: null,
    deprecated: null,
    sourceFile: null,
    directives: null,
  };
}

/**
 * Builds the Query/Mutation/Subscription root type entries that should exist
 * given which root fields were defined.
 */
export function buildRootTypes(presence: RootTypePresence): BaseType[] {
  const rootTypes: BaseType[] = [];

  // GraphQL spec requires Query root type even when only Subscription/Mutation are defined
  if (presence.hasQuery || presence.hasMutation || presence.hasSubscription) {
    rootTypes.push(createRootType("Query"));
  }
  if (presence.hasMutation) {
    rootTypes.push(createRootType("Mutation"));
  }
  if (presence.hasSubscription) {
    rootTypes.push(createRootType("Subscription"));
  }

  return rootTypes;
}
