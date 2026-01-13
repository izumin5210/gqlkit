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

/**
 * Entity interface combining Node and Timestamped.
 * This demonstrates interface inheritance.
 */
export type Entity = GqlInterface<
  {
    id: IDString;
    createdAt: DateTime;
    updatedAt: DateTime;
  },
  { implements: [Node, Timestamped] }
>;

type Context = unknown;
const { defineResolveType } = createGqlkitApis<Context>();

export const entityResolveType = defineResolveType<Entity>(() => "Article");
