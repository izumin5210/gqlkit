import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import { defineMutation } from "../gqlkit.js";
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

/** Input for adding a comment to a post */
export interface AddCommentInput {
  postId: string;
  body: string;
}

/**
 * Add a comment to a post.
 * Publishes a COMMENT_ADDED event scoped to the post ID.
 */
export const addComment = defineMutation<{ input: AddCommentInput }, Comment>(
  (_root, args, ctx) => {
    const comment: Comment = {
      id: crypto.randomUUID() as Comment["id"],
      body: args.input.body,
      postId: args.input.postId as Comment["postId"],
      authorId: (ctx.currentUserId ?? "anonymous") as Comment["authorId"],
      createdAt: new Date(),
      replies: [],
    };
    ctx.pubsub.publish(`COMMENT_ADDED:${args.input.postId}`, comment);
    return comment;
  },
);
