import type { Post } from "../types/post.js";

export type QueryResolver = {
  posts: () => Post[];
};

export const queryResolver: QueryResolver = {
  posts: () => [
    { id: "1", title: "First Post", authorId: "1" },
    { id: "2", title: "Second Post", authorId: "1" },
  ],
};
