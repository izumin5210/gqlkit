import type { GqlInterface, GqlScalar, IDString } from "@gqlkit-ts/runtime";

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
