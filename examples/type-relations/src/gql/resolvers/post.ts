import type { Post } from "../types/post.js";

export type QueryResolver = {
  posts: () => Post[];
};

export const queryResolver: QueryResolver = {
  posts: () => [
    { id: "1", title: "Hello World", content: "First post", author: null },
    { id: "2", title: "Second Post", content: "More content", author: null },
  ],
};
