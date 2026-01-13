import type { GqlDirective, GqlField, NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

type EmptyNameDirective = GqlDirective<
  "",
  Record<string, never>,
  "FIELD_DEFINITION"
>;

export type User = {
  id: GqlField<string, { directives: [EmptyNameDirective] }>;
};

export const user = defineQuery<NoArgs, User | null>(() => null);
