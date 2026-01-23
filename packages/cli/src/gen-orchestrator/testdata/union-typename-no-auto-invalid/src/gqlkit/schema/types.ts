import { defineResolveType } from "../gqlkit.js";

export interface User {
  __typename: string;
  id: string;
  name: string;
}

export interface Post {
  __typename: "Post";
  id: string;
  title: string;
}

export type SearchResult = User | Post;

export const searchResultResolveType = defineResolveType<SearchResult>(
  (value) => {
    return value.__typename;
  },
);
