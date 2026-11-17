import type {
  GqlDirective,
  GqlField,
  GqlObject,
  IDString,
} from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

/**
 * Without the `federation` config, a custom directive may take the name of
 * a federation directive: gqlkit tells federation directives apart by the
 * types from `@gqlkit-ts/runtime/federation`, not by name.
 */
export type KeyDirective<TArgs extends { fields: string }> = GqlDirective<
  "key",
  TArgs,
  "OBJECT"
>;

export type ShareableDirective = GqlDirective<
  "shareable",
  Record<string, never>,
  "FIELD_DEFINITION"
>;

export type User = GqlObject<
  {
    id: IDString;
    name: GqlField<string, { directives: [ShareableDirective] }>;
  },
  { directives: [KeyDirective<{ fields: "id" }>] }
>;

export const user = defineQuery<{ id: IDString }, User | null>(() => null);
