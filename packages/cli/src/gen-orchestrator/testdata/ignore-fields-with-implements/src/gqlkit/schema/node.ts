import type { GqlInterface, IDString } from "@gqlkit-ts/runtime";
import { defineResolveType } from "../gqlkit.js";

/**
 * The Node interface for Relay-style pagination.
 */
export type Node = GqlInterface<{
  id: IDString;
}>;

export const nodeResolveType = defineResolveType<Node>(() => "User");
