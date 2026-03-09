import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { ContentPart, SearchResult } from "./types.js";

export const contentQuery = defineQuery<ContentPart, NoArgs>(
  "content",
  (_args, _ctx) => {
    return { __typename: "TextPart", type: "text", text: "hello" };
  },
);

export const searchQuery = defineQuery<SearchResult, { query: string }>(
  "search",
  (_args, _ctx) => {
    return { __typename: "User", id: "1", name: "Test User" };
  },
);
