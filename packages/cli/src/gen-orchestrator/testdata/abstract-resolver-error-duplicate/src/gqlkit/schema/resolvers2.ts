import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { SearchResult, User } from "./types.js";

type Context = unknown;

const { defineResolveType, defineIsTypeOf } = createGqlkitApis<Context>();

export const searchResultResolveType2 = defineResolveType<SearchResult>(
  (value) => {
    if ("title" in value) {
      return "Post";
    }
    return "User";
  },
);

export const userIsTypeOf2 = defineIsTypeOf<User>(
  (value) => typeof value === "object" && value !== null && "name" in value,
);
