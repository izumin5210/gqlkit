import type { GqlDirective, GqlField } from "@gqlkit-ts/runtime";
import { defineMutation } from "../gqlkit.js";

/**
 * Declared without "ARGUMENT_DEFINITION": valid when used on an input
 * field, but must be rejected when the same field is flattened into a
 * resolver argument.
 */
export type ShortTextDirective<TArgs extends { max: number }> = GqlDirective<
  "shortText",
  TArgs,
  "INPUT_FIELD_DEFINITION"
>;

export type CreateItemInput = {
  name: GqlField<string, { directives: [ShortTextDirective<{ max: 50 }>] }>;
};

export type Item = {
  id: string;
  name: string;
};

export const createItem = defineMutation<CreateItemInput, Item>((_, args) => ({
  id: "1",
  name: args.name,
}));
