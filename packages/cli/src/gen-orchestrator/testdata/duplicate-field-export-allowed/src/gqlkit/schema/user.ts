import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineQuery } from "../gqlkit.js";
import type { Comment, Post } from "./post.js";

export interface User {
  id: string;
  name: string;
}

export const posts = defineField<User, NoArgs, Post[]>(() => []);

/**
 * Same export name "comments" as in post.ts.
 * This should NOT cause an error since they target different parent types.
 */
export const comments = defineField<User, NoArgs, Comment[]>(() => []);

export const getUsers = defineQuery<NoArgs, User[]>(() => []);
