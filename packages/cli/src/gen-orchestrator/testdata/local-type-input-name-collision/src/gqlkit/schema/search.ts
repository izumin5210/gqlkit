import { defineQuery } from "../gqlkit.js";

// Not exported, and used as an input: it would become FilterInput, which
// is already declared below as a different type.
interface Filter {
  keyword: string;
}

export interface FilterInput {
  tag: string;
}

export const search = defineQuery<{ filter: Filter }, boolean>(() => true);

export const searchByTag = defineQuery<{ filter: FilterInput }, boolean>(
  () => true,
);
