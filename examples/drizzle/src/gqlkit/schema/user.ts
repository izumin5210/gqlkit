import type { NoArgs } from "@gqlkit-ts/runtime";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { posts as postsTable, users as usersTable } from "../../db/schema.js";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";
import type { Post } from "./post.js";

export type User = InferSelectModel<typeof usersTable>;
export type CreateUserInput = Omit<
  InferInsertModel<typeof usersTable>,
  "id" | "createdAt"
>;

export const allUsers = defineQuery<NoArgs, User[]>(
  async (_root, _args, ctx) => {
    return ctx.db.select().from(usersTable);
  },
);

export const user = defineQuery<{ id: number }, User | null>(
  async (_root, args, ctx) => {
    const result = await ctx.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, args.id));
    return result[0] ?? null;
  },
);

export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  async (_root, args, ctx) => {
    const result = await ctx.db
      .insert(usersTable)
      .values({
        name: args.input.name,
        email: args.input.email,
        status: args.input.status ?? undefined,
      })
      .returning();
    return result[0]!;
  },
);

export const posts = defineField<User, NoArgs, Post[]>(
  async (parent, _args, ctx) => {
    return ctx.db
      .select()
      .from(postsTable)
      .where(eq(postsTable.authorId, parent.id));
  },
);
