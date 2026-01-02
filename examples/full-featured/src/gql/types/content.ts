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
