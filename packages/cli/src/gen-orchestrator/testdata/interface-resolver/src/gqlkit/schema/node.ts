import type { DefineInterface, IDString, NoArgs } from "@gqlkit-ts/runtime";
import { createGqlkitApis } from "@gqlkit-ts/runtime";

const { defineField } = createGqlkitApis();

/**
 * The Node interface for Relay-style pagination.
 */
export type Node = DefineInterface<{
  id: IDString;
}>;

/**
 * Computed globalId field for Node interface.
 */
export const globalId = defineField<Node, NoArgs, string>((node) => {
  return `global:${node.id}`;
});
