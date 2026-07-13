import type { GqlField, Int } from "@gqlkit-ts/runtime";
import { defineMutation } from "../gqlkit.js";

// A local (non-exported) args type, so this is the only extraction pass that
// walks its fields — mirrors `default-value-errors`'s pattern (a
// `GqlField` `defaultValue` that isn't a literal type, so it fails
// resolution) but for a resolver argument instead of a declared type field.
interface UpdateAgeArgs {
  id: string;
  age: GqlField<Int, { defaultValue: number }>;
}

export const updateAge = defineMutation<UpdateAgeArgs, boolean>(
  (_root, _args) => true,
);
