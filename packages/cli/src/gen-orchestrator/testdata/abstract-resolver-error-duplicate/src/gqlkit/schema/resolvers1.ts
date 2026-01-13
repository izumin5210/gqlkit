import { defineIsTypeOf, defineResolveType } from "../gqlkit.js";
import type { SearchResult, User } from "./types.js";

export const searchResultResolveType1 = defineResolveType<SearchResult>(
  (value) => {
    if ("name" in value) {
      return "User";
    }
    return "Post";
  },
);

export const userIsTypeOf1 = defineIsTypeOf<User>(
  (value) => typeof value === "object" && value !== null && "name" in value,
);
