import { defineMutation, defineQuery } from "../gqlkit.js";

// Not exported: the resolvers below are what make these schema types.
interface Range {
  from: number;
  to: number;
}

interface Filter {
  keyword: string;
  range: Range;
}

interface CreateItemInput {
  name: string;
}

interface Item {
  name: string;
  // Range is also an output here, so both Range and RangeInput exist.
  range: Range;
}

export const search = defineQuery<{ filter: Filter }, Item[]>(() => []);

// Flattened arguments: Filter itself is not referenced, its fields are.
export const searchFlat = defineQuery<Filter, Item[]>(() => []);

export const createItem = defineMutation<{ input: CreateItemInput }, Item>(
  (_root, args) => ({ name: args.input.name, range: { from: 0, to: 0 } }),
);
