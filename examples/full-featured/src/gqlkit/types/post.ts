import type { IDString } from "@gqlkit-ts/runtime";
import type { DateTime } from "../scalars.js";
import type { PostStatus } from "./status.js";

/**
 * A blog post
 */
export interface Post {
  /** Unique identifier for the post */
  id: IDString;
  /** Post title */
  title: string;
  /** Post content body */
  body: string;
  /** Publication status */
  status: PostStatus;
  /** Post author's ID */
  authorId: IDString;
  /** Tags associated with this post (may contain null for deleted tags) */
  tags: (string | null)[];
  /** When the post was published (null if draft) */
  publishedAt: DateTime | null;
  /** When the post was created */
  createdAt: DateTime;
}

/** Input for creating a new post */
export interface CreatePostInput {
  title: string;
  body: string;
  tags: string[] | null;
}
