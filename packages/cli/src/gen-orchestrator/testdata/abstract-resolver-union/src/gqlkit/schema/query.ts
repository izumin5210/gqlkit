import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { SearchResult } from "./types.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const search = defineQuery<{ query: string }, SearchResult[]>(
  (_root, _args) => [],
);
