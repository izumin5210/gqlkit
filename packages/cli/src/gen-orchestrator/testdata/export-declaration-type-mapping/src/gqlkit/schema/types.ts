import { defineResolveType } from "../gqlkit.js";

export type {
  Article,
  ArticleStatus,
  CreateArticleInput,
  ImageResult,
  SearchResult,
  TextResult,
} from "../../external/types.js";

import type { SearchResult } from "../../external/types.js";

export const searchResultResolveType = defineResolveType<SearchResult>(
  (value) => {
    if ("text" in value) return "TextResult";
    return "ImageResult";
  },
);
