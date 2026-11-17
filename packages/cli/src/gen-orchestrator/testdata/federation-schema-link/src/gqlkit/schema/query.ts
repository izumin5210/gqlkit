import type { IDString } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export type User = {
  id: IDString;
  name: string;
};

/**
 * A subgraph that only exposes root fields still links the federation spec,
 * so composition treats it as federation v2 rather than v1.
 */
export const user = defineQuery<{ id: IDString }, User | null>(() => null);
