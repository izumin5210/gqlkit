import type { GqlDirective, GqlField, NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export type ObjectOnlyDirective = GqlDirective<
  "objectOnly",
  Record<string, never>,
  "OBJECT"
>;

export type User = {
  id: GqlField<string, { directives: [ObjectOnlyDirective] }>;
};

export const user = defineQuery<NoArgs, User | null>(() => null);
