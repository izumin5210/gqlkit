import { defineField, defineMutation, defineQuery } from "../gqlkit.js";

export type User = {
  id: string;
  name: string;
};

export type Post = {
  id: string;
  title: string;
  authorId: string;
};

/**
 * Query with inline string literal union enum in args
 */
export const searchUsers = defineQuery<
  {
    /** Sort order for results */
    sortOrder: "asc" | "desc";
    /** Status filter */
    status: "active" | "inactive" | "pendingReview" | null;
  },
  User[]
>((_root, _args) => []);

/**
 * Mutation with inline enum in nested arg object
 */
export const createPost = defineMutation<
  {
    input: {
      title: string;
      /** Post visibility */
      visibility: "public" | "private" | "unlisted";
    };
  },
  Post
>((_root, args) => ({
  id: "1",
  title: args.input.title,
  authorId: "1",
}));

/**
 * Field resolver with inline enum in args
 */
export const posts = defineField<
  User,
  {
    /** Sort by field */
    sortBy: "createdAt" | "updatedAt" | "title";
    /** Filter by category */
    category: "tech" | "lifestyle" | "news" | null;
  },
  Post[]
>((_parent, _args) => []);
