import type { GqlInterface, IDString, NoArgs } from "@gqlkit-ts/runtime";
import { createGqlkitApis } from "@gqlkit-ts/runtime";

const { defineField, defineResolveType } = createGqlkitApis();

/**
 * The Node interface for Relay-style pagination.
 */
export type Node = GqlInterface<{
  id: IDString;
}>;

/**
 * Computed globalId field for Node interface.
 */
export const globalId = defineField<Node, NoArgs, string>((node) => {
  return `global:${node.id}`;
});

export const nodeResolveType = defineResolveType<Node>(() => "User");
