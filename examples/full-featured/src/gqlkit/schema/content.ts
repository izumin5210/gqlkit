import { defineQuery } from "../gqlkit.js";
import type { Comment } from "./comment.js";
import type { Post } from "./post.js";

/**
 * Union type representing any content that can be searched
 */
export type SearchResult = Post | Comment;

/**
 * Timeline content (posts and comments mixed)
 */
export type TimelineItem = Post | Comment;

const posts: Post[] = [
  {
    id: "1" as Post["id"],
    title: "Hello World",
    body: "This is my first post",
    status: "PUBLISHED" as unknown as Post["status"],
    authorId: "1" as Post["authorId"],
    tags: ["intro", "hello"],
    publishedAt: "2024-01-15T10:00:00Z" as Post["publishedAt"],
    createdAt: "2024-01-15T09:00:00Z" as Post["createdAt"],
  },
];

/**
 * Search for content (posts and comments)
 */
export const search = defineQuery<{ query: string }, SearchResult[]>(
  (_root, args) => {
    const q = args.query.toLowerCase();
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q),
    );
  },
);
