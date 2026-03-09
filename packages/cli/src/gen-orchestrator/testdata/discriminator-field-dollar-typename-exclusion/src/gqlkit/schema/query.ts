import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { ContentPart, SearchResult } from "./types.js";

export const contentQuery = defineQuery<NoArgs, ContentPart>(
  "content",
  (_args, _ctx) => {
    return { $typeName: "TextPart" as const, type: "text" as const, text: "hello" };
  },
);

export const searchQuery = defineQuery<{ query: string }, SearchResult>(
  "search",
  (_args, _ctx) => {
    return { $typeName: "User" as const, id: "1", name: "Test User" };
  },
);
