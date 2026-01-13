import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = unknown;

export interface Article {
  id: string;
  title: string;
  content: string;
}

export interface Video {
  id: string;
  title: string;
  duration: number;
}

export type SearchResult = Article | Video;

const { defineResolveType } = createGqlkitApis<Context>();

export const searchResultResolveType = defineResolveType<SearchResult>(
  (value) => {
    if ("content" in value) {
      return "Article";
    }
    return "Video";
  },
);
