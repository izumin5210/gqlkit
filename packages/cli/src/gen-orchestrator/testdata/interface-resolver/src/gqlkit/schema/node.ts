import type { GqlInterface, IDString, NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineResolveType } from "../gqlkit.js";

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
