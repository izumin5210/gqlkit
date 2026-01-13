import { defineIsTypeOf, defineResolveType } from "../gqlkit.js";

export interface User {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  title: string;
}

export type SearchResult = User | Post;

export const userResolveType = defineResolveType<User>(() => "User");

export const searchResultIsTypeOf = defineIsTypeOf<SearchResult>(() => true);
