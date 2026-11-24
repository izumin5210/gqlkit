import type { GqlInterface, IDString, NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineResolveType } from "../gqlkit.js";

export type Node = GqlInterface<{
  id: IDString;
}>;

/**
 * Inherited by every type implementing Node, directly or through Entity.
 */
export const globalId = defineField<Node, NoArgs, string>((node) => {
  return `global:${node.id}`;
});

/**
 * Overridden by User's own label field resolver.
 */
export const label = defineField<Node, NoArgs, string>((node) => node.id);

/**
 * Not inherited by User, which declares kind as a property.
 */
export const kind = defineField<Node, NoArgs, string>(() => "node");

export const nodeResolveType = defineResolveType<Node>(() => "User");
