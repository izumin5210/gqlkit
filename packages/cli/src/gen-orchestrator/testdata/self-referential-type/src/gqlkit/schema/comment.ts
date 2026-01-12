import {
  createGqlkitApis,
  type GqlObject,
  type IDString,
  type NoArgs,
} from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery, defineField } = createGqlkitApis<Context>();

/**
 * A comment that can have nested replies (self-referential type).
 * This tests that GqlObject intersection types with self-references
 * are handled correctly without infinite recursion.
 */
export type Comment = GqlObject<{
  id: IDString;
  body: string;
  /** Replies to this comment - self-referential field */
  replies: Comment[];
}>;

const comments: Comment[] = [];

export const allComments = defineQuery<NoArgs, Comment[]>(() => comments);

export const comment = defineQuery<{ id: string }, Comment | null>(
  (_root, args) => comments.find((c) => c.id === args.id) ?? null,
);

export const replyCount = defineField<Comment, NoArgs, number>(
  (parent) => parent.replies.length,
);
