import type { GqlInterface, IDString } from "@gqlkit-ts/runtime";

/**
 * Node interface for global identification.
 */
export type Node = GqlInterface<{
  id: IDString;
}>;
