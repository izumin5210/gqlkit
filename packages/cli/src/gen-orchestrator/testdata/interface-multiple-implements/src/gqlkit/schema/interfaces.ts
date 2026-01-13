import {
  createGqlkitApis,
  type GqlInterface,
  type GqlScalar,
  type IDString,
} from "@gqlkit-ts/runtime";

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

type Context = unknown;
const { defineResolveType } = createGqlkitApis<Context>();

export const nodeResolveType = defineResolveType<Node>(() => "Post");
export const timestampedResolveType = defineResolveType<Timestamped>(
  () => "Post",
);
