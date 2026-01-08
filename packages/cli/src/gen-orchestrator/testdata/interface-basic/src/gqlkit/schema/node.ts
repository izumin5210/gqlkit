import type { DefineInterface, IDString } from "@gqlkit-ts/runtime";

/**
 * The Node interface for Relay-style pagination.
 */
export type Node = DefineInterface<{
  id: IDString;
}>;
