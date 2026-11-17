import type { GqlDirective, GqlField, IDString } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

/**
 * Collides with the `@link` directive that federation applies to the
 * schema, which gqlkit defines in the generated typeDefs.
 */
export type LinkDirective<TArgs extends { href: string }> = GqlDirective<
  "link",
  TArgs,
  "FIELD_DEFINITION"
>;

export type User = {
  id: IDString;
  homepage: GqlField<
    string,
    { directives: [LinkDirective<{ href: "https://example.com" }>] }
  >;
};

export const user = defineQuery<{ id: IDString }, User | null>(() => null);
