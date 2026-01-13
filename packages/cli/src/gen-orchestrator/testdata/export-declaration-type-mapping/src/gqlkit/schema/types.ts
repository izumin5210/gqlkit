import { createGqlkitApis } from "@gqlkit-ts/runtime";

export type {
  Article,
  ArticleStatus,
  CreateArticleInput,
  ImageResult,
  SearchResult,
  TextResult,
} from "../../external/types.js";

import type { SearchResult } from "../../external/types.js";

type Context = unknown;
const { defineResolveType } = createGqlkitApis<Context>();

export const searchResultResolveType = defineResolveType<SearchResult>(
  (value) => {
    if ("text" in value) return "TextResult";
    return "ImageResult";
  },
);
