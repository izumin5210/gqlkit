import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { SearchResult } from "./types.js";

export const searchQuery = defineQuery<NoArgs, SearchResult>((_root, _args) => {
  return {
    __typename: "User",
    id: "1",
    name: "Test User",
  };
});
