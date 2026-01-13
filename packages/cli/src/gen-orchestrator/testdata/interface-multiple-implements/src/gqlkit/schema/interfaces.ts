import type { GqlInterface, GqlScalar, IDString } from "@gqlkit-ts/runtime";
import { defineResolveType } from "../gqlkit.js";

/**
 * Custom DateTime scalar.
 */
export type DateTime = GqlScalar<"DateTime", Date>;

/**
 * Node interface for global identification.
 */
export type Node = GqlInterface<{
  id: IDString;
}>;

/**
 * Timestamped interface for entities with timestamps.
 */
export type Timestamped = GqlInterface<{
  createdAt: DateTime;
  updatedAt: DateTime;
}>;

export const nodeResolveType = defineResolveType<Node>(() => "Post");
export const timestampedResolveType = defineResolveType<Timestamped>(
  () => "Post",
);
