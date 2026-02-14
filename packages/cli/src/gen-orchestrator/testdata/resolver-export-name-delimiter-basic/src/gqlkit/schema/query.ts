import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";
import type {
  Comment,
  CreatePostInput,
  Post,
  UpdatePostInput,
} from "./types.js";

export const Query$root$posts = defineQuery<NoArgs, Post[]>(() => []);

export const Query$post = defineQuery<{ id: string }, Post | null>(() => null);

export const Query$comments = defineQuery<NoArgs, Comment[]>(() => []);

export const Mutation$admin$createPost = defineMutation<CreatePostInput, Post>(
  (_root, args) => ({
    id: "new-id",
    title: args.title,
    content: args.content,
    authorId: "author-1",
  }),
);

export const Mutation$updatePost = defineMutation<
  { id: string; input: UpdatePostInput },
  Post | null
>(() => null);

export const Post$relation$postComments = defineField<Post, NoArgs, Comment[]>(
  () => [],
);

export const Comment$relation$commentPost = defineField<
  Comment,
  NoArgs,
  Post | null
>(() => null);
