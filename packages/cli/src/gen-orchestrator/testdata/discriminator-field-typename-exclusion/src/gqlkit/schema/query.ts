import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { ContentPart, SearchResult } from "./types.js";

export const contentQuery = defineQuery<NoArgs, ContentPart>(
  "content",
  (_args, _ctx) => {
    return { __typename: "TextPart", type: "text", text: "hello" };
  },
);

export const searchQuery = defineQuery<{ query: string }, SearchResult>(
  "search",
  (_args, _ctx) => {
    return { __typename: "User", id: "1", name: "Test User" };
  },
);
