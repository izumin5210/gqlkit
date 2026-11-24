import type { GqlDirective, GqlObject } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export type TagDirective = GqlDirective<
  "tag",
  Record<string, never>,
  ["INPUT_OBJECT"]
>;

export type LabelDirective = GqlDirective<
  "label",
  { value: "primary" },
  ["INPUT_OBJECT"]
>;

/**
 * Type-level directives on an input object type are validated against
 * INPUT_OBJECT, so they must also be emitted on the generated input type.
 */
export type FilterInput = GqlObject<
  { name: string },
  { directives: [TagDirective, LabelDirective] }
>;

export const items = defineQuery<{ filter: FilterInput }, string[]>(() => []);
