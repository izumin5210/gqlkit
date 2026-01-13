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

const { defineResolveType, defineIsTypeOf } = createGqlkitApis<Context>();

export const userResolveType = defineResolveType<User>(() => "User");

export const searchResultIsTypeOf = defineIsTypeOf<SearchResult>(() => true);
