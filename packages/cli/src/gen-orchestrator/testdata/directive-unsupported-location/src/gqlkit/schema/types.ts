import type { GqlDirective, NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export type ScalarDirective = GqlDirective<
  "scalarOnly",
  Record<string, never>,
  "SCALAR"
>;

export type User = {
  id: string;
};

export const user = defineQuery<NoArgs, User | null>(() => null);
