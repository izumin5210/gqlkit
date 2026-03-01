import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineSubscription } from "../gqlkit.js";
import type { Comment } from "./comment.js";
import type { Post } from "./post.js";

/** Notifies when a new post is created */
export const postCreated = defineSubscription<NoArgs, Post>(
  async function* (_root, _args, ctx) {
    yield* ctx.pubsub.subscribe<Post>("POST_CREATED");
  },
);

/** Notifies when a comment is added to a specific post */
export const commentAdded = defineSubscription<{ postId: string }, Comment>(
  async function* (_root, args, ctx) {
    yield* ctx.pubsub.subscribe<Comment>(`COMMENT_ADDED:${args.postId}`);
  },
);
