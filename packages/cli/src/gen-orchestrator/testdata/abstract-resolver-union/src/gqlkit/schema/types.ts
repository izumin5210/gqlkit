import { defineResolveType } from "../gqlkit.js";

export interface User {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  title: string;
}

export type SearchResult = User | Post;

export const searchResultResolveType = defineResolveType<SearchResult>(
  (value) => {
    if ("name" in value) {
      return "User";
    }
    return "Post";
  },
);
