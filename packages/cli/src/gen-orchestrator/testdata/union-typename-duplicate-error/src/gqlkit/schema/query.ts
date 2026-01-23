import { defineQuery } from "../gqlkit.js";
import type { SearchResult } from "./types.js";

export const search = defineQuery<{ query: string }, SearchResult>(
  (_root, _args) => ({ __typename: "Person", id: "1", name: "Test" }),
);
