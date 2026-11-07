import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineQuery } from "../gqlkit.js";

export interface Post {
  id: string;
  title: string;
}

export interface Comment {
  id: string;
  text: string;
}

/**
 * Same export name "comments" as in user.ts.
 * This should NOT cause an error since they target different parent types.
 */
export const comments = defineField<Post, NoArgs, Comment[]>(() => []);

export const getPosts = defineQuery<NoArgs, Post[]>(() => []);
