import { defineQuery, type NoArgs } from "../gqlkit.js";
import type { Post } from "../types/post.js";

export const posts = defineQuery<NoArgs, Post[]>(() => [
  { id: "1", title: "Hello World", content: "First post", author: null },
  { id: "2", title: "Second Post", content: "More content", author: null },
]);
