import type { GqlInterface, IDString } from "@gqlkit-ts/runtime";
import { defineResolveType } from "../gqlkit.js";

/**
 * Node interface for global identification.
 */
export type Node = GqlInterface<{
  id: IDString;
}>;

export const nodeResolveType = defineResolveType<Node>(() => "User");
