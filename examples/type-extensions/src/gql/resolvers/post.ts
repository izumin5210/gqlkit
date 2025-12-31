import { defineQuery, type NoArgs } from "../gqlkit.js";
import type { Post } from "../types/post.js";

export const posts = defineQuery<NoArgs, Post[]>(() => [
  { id: "1", title: "First Post", authorId: "1" },
  { id: "2", title: "Second Post", authorId: "1" },
]);
