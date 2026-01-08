import type { DefineInterface, IDString } from "@gqlkit-ts/runtime";

/**
 * Node interface for global identification.
 */
export type Node = DefineInterface<{
  id: IDString;
}>;
