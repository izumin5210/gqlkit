import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type {
  Article,
  ArticleStatus,
  CreateArticleInput,
  SearchResult,
} from "./types.js";

type Context = unknown;

const { defineMutation, defineQuery } = createGqlkitApis<Context>();

export const articles = defineQuery<NoArgs, Article[]>(() => []);

export const article = defineQuery<{ id: string }, Article | null>(
  (_root, args) => ({
    id: args.id,
    title: "Test Article",
    viewCount: 100,
    isPublished: true,
    authorId: null,
    tags: ["typescript", "graphql"],
    ratings: [5, 4, 5],
  }),
);

export const articleStatus = defineQuery<{ id: string }, ArticleStatus>(
  (_root, _args) => "DRAFT",
);

export const search = defineQuery<{ query: string }, SearchResult[]>(
  (_root, _args) => [],
);

export const createArticle = defineMutation<CreateArticleInput, Article>(
  (_root, args) => ({
    id: "new-id",
    title: args.title,
    viewCount: 0,
    isPublished: args.isPublished ?? false,
    authorId: null,
    tags: args.tags,
    ratings: null,
  }),
);
