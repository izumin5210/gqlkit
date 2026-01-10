import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Node, Timestamped } from "./node.js";
import type { DateTime } from "./scalars.js";

/**
 * A comment on a post.
 * Implements Node (identifiable) and Timestamped (has createdAt).
 */
export type Comment = GqlObject<
  {
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
  },
  { implements: [Node, Timestamped] }
>;
