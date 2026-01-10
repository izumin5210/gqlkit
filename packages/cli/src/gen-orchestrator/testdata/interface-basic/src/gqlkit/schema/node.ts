import type { GqlInterface, IDString } from "@gqlkit-ts/runtime";

/**
 * The Node interface for Relay-style pagination.
 */
export type Node = GqlInterface<{
  id: IDString;
}>;
