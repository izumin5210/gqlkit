import type { IDString } from "@gqlkit-ts/runtime";
import type { DateTime } from "./scalars.js";

/**
 * A comment on a post
 */
export interface Comment {
  /** Unique identifier for the comment */
  id: IDString;
  /** Comment text content */
  body: string;
  /** ID of the post this comment belongs to */
  postId: IDString;
  /** ID of the user who wrote this comment */
  authorId: IDString;
  /** When the comment was created */
  createdAt: DateTime;
  /** Replies to this comment (nested list) */
  replies: Comment[];
}
