import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";
import type {
  Comment,
  CreatePostInput,
  Post,
  UpdatePostInput,
} from "./types.js";

export const posts = defineQuery<NoArgs, Post[]>(() => []);

export const post = defineQuery<{ id: string }, Post | null>(() => null);

export const comments = defineQuery<NoArgs, Comment[]>(() => []);

export const createPost = defineMutation<CreatePostInput, Post>(
  (_root, args) => ({
    id: "new-id",
    title: args.title,
    content: args.content,
    authorId: "author-1",
  }),
);

export const updatePost = defineMutation<
  { id: string; input: UpdatePostInput },
  Post | null
>(() => null);

export const postComments = defineField<Post, NoArgs, Comment[]>(() => []);

export const commentPost = defineField<Comment, NoArgs, Post | null>(
  () => null,
);
