import { defineResolveType } from "../gqlkit.js";

// Test: Manual resolveType fallback when auto-generation is not possible
//
// This test validates that when a union has members with non-literal __typename
// types (User has `string` instead of `"User"`), a manually defined resolveType
// via defineResolveType is accepted and used.
//
// Distinction from abstract-resolver-union:
// - abstract-resolver-union tests explicit resolveType with types that have no __typename
// - This test validates the interaction between non-literal __typename and manual resolveType

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
