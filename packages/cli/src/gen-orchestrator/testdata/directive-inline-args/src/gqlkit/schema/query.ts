import type { GqlDirective, GqlField } from "@gqlkit-ts/runtime";
import { defineField, defineQuery } from "../gqlkit.js";

export type MaxLengthDirective<TArgs extends { max: number }> = GqlDirective<
  "maxLength",
  TArgs,
  "ARGUMENT_DEFINITION"
>;

export type Item = {
  id: string;
  name: string;
};

/**
 * Args type is an inline object literal (not a named type alias), covering
 * directive detection on arguments that never go through a declared input
 * type — only default-value-with-directives exercised named args types.
 */
export const search = defineQuery<
  {
    query: GqlField<string, { directives: [MaxLengthDirective<{ max: 100 }>] }>;
  },
  Item[]
>((_root, _args) => []);

/**
 * Field resolver arguments are emitted on an `extend type` of the parent
 * object rather than of a root operation type.
 */
export const excerpt = defineField<
  Item,
  {
    length: GqlField<
      number,
      { directives: [MaxLengthDirective<{ max: 500 }>] }
    >;
  },
  string
>((parent, args) => parent.name.slice(0, args.length));
