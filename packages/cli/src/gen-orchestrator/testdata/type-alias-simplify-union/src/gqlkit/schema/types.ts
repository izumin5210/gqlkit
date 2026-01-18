import { defineResolveType } from "../gqlkit.js";

type Simplify<T> = { [K in keyof T]: T[K] } & {};

interface InternalUser {
  id: number;
  name: string;
}

export type User = Simplify<InternalUser>;

export interface Post {
  id: number;
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
