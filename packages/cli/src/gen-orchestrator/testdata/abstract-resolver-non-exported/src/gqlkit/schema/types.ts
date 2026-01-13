import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = unknown;

export interface User {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  title: string;
}

export type SearchResult = User | Post;

const { defineResolveType } = createGqlkitApis<Context>();

const searchResultResolveType = defineResolveType<SearchResult>((value) => {
  if ("name" in value) {
    return "User";
  }
  return "Post";
});
