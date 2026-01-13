import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { SearchResult, User } from "./types.js";

type Context = unknown;

const { defineResolveType, defineIsTypeOf } = createGqlkitApis<Context>();

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
