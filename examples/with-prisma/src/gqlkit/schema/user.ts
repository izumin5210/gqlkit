import type { NoArgs } from "@gqlkit-ts/runtime";
import type { Prisma } from "../../__generated__/prisma/client.js";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";
import type { Post } from "./post.js";

export type User = Prisma.UserModel;

export const allUsers = defineQuery<NoArgs, User[]>(
  async (_root, _args, ctx) => {
    return ctx.db.user.findMany();
  },
);

export const user = defineQuery<{ id: string }, User | null>(
  async (_root, args, ctx) => {
    return ctx.db.user.findUnique({
      where: { id: args.id },
    });
  },
);

export const createUser = defineMutation<
  { input: Omit<Prisma.UserCreateInput, "id" | "createdAt" | "posts"> },
  User
>(async (_root, args, ctx) => {
  return ctx.db.user.create({
    data: args.input,
  });
});

export const posts = defineField<User, NoArgs, Post[]>(
  async (parent, _args, ctx) => {
    return ctx.db.post.findMany({
      where: { authorId: parent.id },
    });
  },
);
