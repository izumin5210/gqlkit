import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineQuery } from "../gqlkit.js";

/**
 * User type - single word parent type name
 */
export type User = {
  id: string;
  name: string;
};

/**
 * BlogPost type - multi-word parent type name (PascalCase)
 */
export type BlogPost = {
  id: string;
  title: string;
  authorId: string;
};

/**
 * Article type - another single word parent type
 */
export type Article = {
  id: string;
  content: string;
};

/**
 * Query to fetch users
 */
export const users = defineQuery<NoArgs, User[]>(() => []);

/**
 * Query to fetch posts
 */
export const posts = defineQuery<NoArgs, BlogPost[]>(() => []);

/**
 * Query to fetch articles
 */
export const articles = defineQuery<NoArgs, Article[]>(() => []);

/**
 * Field resolver on User returning inline object.
 * Expected generated type: UserStatsPayload
 */
export const stats = defineField<
  User,
  NoArgs,
  {
    postCount: number;
    followerCount: number;
  }
>(() => ({
  postCount: 0,
  followerCount: 0,
}));

/**
 * Field resolver on BlogPost returning inline object.
 * Expected generated type: BlogPostMetadataPayload
 * Verifies that multi-word parent type name is preserved as-is.
 */
export const metadata = defineField<
  BlogPost,
  NoArgs,
  {
    viewCount: number;
    likeCount: number;
    publishedAt: string;
  }
>(() => ({
  viewCount: 0,
  likeCount: 0,
  publishedAt: "2025-01-01",
}));

/**
 * Field resolver on Article returning inline object.
 * Expected generated type: ArticleRelatedContentPayload
 * Verifies multi-word field name handling.
 */
export const relatedContent = defineField<
  Article,
  NoArgs,
  {
    relatedArticles: Article[];
    suggestedPosts: BlogPost[];
  }
>(() => ({
  relatedArticles: [],
  suggestedPosts: [],
}));
