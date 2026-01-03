import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = unknown;
type SearchResult = { id: string; name?: string; title?: string };

const { defineQuery } = createGqlkitApis<Context>();

export const search = defineQuery<{ query: string }, SearchResult[]>(
  (_root, _args) => [],
);
