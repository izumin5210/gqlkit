import { defineResolveType } from "../gqlkit.js";

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

export const searchResultResolveType = defineResolveType<SearchResult>(
  (value) => {
    if ("content" in value) {
      return "Article";
    }
    return "Video";
  },
);
