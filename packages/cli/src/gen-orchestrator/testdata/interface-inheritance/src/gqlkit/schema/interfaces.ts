import type {
  DefineInterface,
  DefineScalar,
  IDString,
} from "@gqlkit-ts/runtime";

/**
 * Custom DateTime scalar.
 */
export type DateTime = DefineScalar<"DateTime", Date>;

/**
 * Node interface for global identification.
 */
export type Node = DefineInterface<{
  id: IDString;
}>;

/**
 * Timestamped interface for entities with timestamps.
 */
export type Timestamped = DefineInterface<{
  createdAt: DateTime;
  updatedAt: DateTime;
}>;

/**
 * Entity interface combining Node and Timestamped.
 * This demonstrates interface inheritance.
 */
export type Entity = DefineInterface<
  {
    id: IDString;
    createdAt: DateTime;
    updatedAt: DateTime;
  },
  { implements: [Node, Timestamped] }
>;
