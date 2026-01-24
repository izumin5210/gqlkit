import type { NoArgs } from "@gqlkit-ts/runtime";
import type { Prisma } from "../../__generated__/prisma/client.js";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";
import type { User } from "./user.js";

export type Post = Prisma.PostModel;

export const allPosts = defineQuery<NoArgs, Post[]>(
  async (_root, _args, ctx) => {
    return ctx.db.post.findMany();
  },
);

export const post = defineQuery<{ id: string }, Post | null>(
  async (_root, args, ctx) => {
    return ctx.db.post.findUnique({
      where: { id: args.id },
    });
  },
);

export const createPost = defineMutation<
  {
    input: Omit<Prisma.PostCreateInput, "id" | "createdAt" | "author"> & {
      authorId: string;
    };
  },
  Post
>(async (_root, args, ctx) => {
  const { authorId, ...data } = args.input;
  return ctx.db.post.create({
    data: {
      ...data,
      author: { connect: { id: authorId } },
    },
  });
});

export const author = defineField<Post, NoArgs, User | null>(
  async (parent, _args, ctx) => {
    return ctx.db.user.findUnique({
      where: { id: parent.authorId },
    });
  },
);
