import type { NoArgs } from "@gqlkit-ts/runtime";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { posts as postsTable, users as usersTable } from "../../db/schema.js";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";
import type { User } from "./user.js";

export type Post = InferSelectModel<typeof postsTable>;
export type CreatePostInput = Omit<
  InferInsertModel<typeof postsTable>,
  "id" | "createdAt"
>;

export const allPosts = defineQuery<NoArgs, Post[]>(
  async (_root, _args, ctx) => {
    return ctx.db.select().from(postsTable);
  },
);

export const post = defineQuery<{ id: number }, Post | null>(
  async (_root, args, ctx) => {
    const result = await ctx.db
      .select()
      .from(postsTable)
      .where(eq(postsTable.id, args.id));
    return result[0] ?? null;
  },
);

export const createPost = defineMutation<{ input: CreatePostInput }, Post>(
  async (_root, args, ctx) => {
    const result = await ctx.db
      .insert(postsTable)
      .values({
        title: args.input.title,
        content: args.input.content,
        status: args.input.status ?? undefined,
        authorId: args.input.authorId,
      })
      .returning();
    return result[0]!;
  },
);

export const author = defineField<Post, NoArgs, User | null>(
  async (parent, _args, ctx) => {
    const result = await ctx.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, parent.authorId));
    return result[0] ?? null;
  },
);
