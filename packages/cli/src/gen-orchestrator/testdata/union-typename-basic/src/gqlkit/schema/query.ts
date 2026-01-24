import { defineQuery } from "../gqlkit.js";
import type { SearchResult } from "./types.js";

export const searchQuery = defineQuery<SearchResult, { query: string }>(
  "search",
  (_args, _ctx) => {
    return { __typename: "User", id: "1", name: "Test User" };
  },
);
