import type { GqlInterface, IDString } from "@gqlkit-ts/runtime";

/**
 * Node interface for global identification.
 */
export type Node = GqlInterface<{
  id: IDString;
}>;

/**
 * Entity interface combining identity and freshness tracking.
 */
export type Entity = GqlInterface<
  {
    id: IDString;
    updatedAt: string;
  },
  { implements: [Node] }
>;
