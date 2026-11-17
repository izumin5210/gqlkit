import type {
  GqlDirective,
  GqlField,
  GqlObject,
  IDString,
} from "@gqlkit-ts/runtime";
import type { Key } from "@gqlkit-ts/runtime/federation";
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

/**
 * Collides with `@key`, which the schema imports from the federation spec
 * because User uses `Key`.
 */
export type KeyDirective = GqlDirective<
  "key",
  Record<string, never>,
  "FIELD_DEFINITION"
>;

export type User = GqlObject<
  {
    id: IDString;
    homepage: GqlField<
      string,
      {
        directives: [
          LinkDirective<{ href: "https://example.com" }>,
          KeyDirective,
        ];
      }
    >;
  },
  { directives: [Key<"id">] }
>;

export const user = defineQuery<{ id: IDString }, User | null>(() => null);
