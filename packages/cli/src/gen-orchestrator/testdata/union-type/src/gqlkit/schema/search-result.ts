import { createGqlkitApis } from "@gqlkit-ts/runtime";

export interface User {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  title: string;
}

export type SearchResult = User | Post;

type Context = unknown;
const { defineResolveType } = createGqlkitApis<Context>();

export const searchResultResolveType = defineResolveType<SearchResult>(
  (value) => {
    if ("name" in value) return "User";
    return "Post";
  },
);
