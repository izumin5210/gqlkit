import { defineQuery } from "../gqlkit.js";

type SearchResult = { id: string; name?: string; title?: string };

export const search = defineQuery<{ query: string }, SearchResult[]>(
  (_root, _args) => [],
);
