import type { GqlDirective, GqlField, NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

type InternalAuthDirective<TArgs extends { role: string[] }> = GqlDirective<
  "auth",
  TArgs,
  "FIELD_DEFINITION"
>;

export type User = {
  id: GqlField<
    string,
    { directives: [InternalAuthDirective<{ role: ["USER"] }>] }
  >;
};

export const user = defineQuery<NoArgs, User | null>(() => null);
