import type { NoArgs } from "@gqlkit-ts/runtime";
// Import User from external package - this is NOT the schema User
import type { User as ExternalUser } from "../../external/types.js";
import { defineField, defineQuery } from "../gqlkit.js";
import type { User } from "./user.js";

/**
 * Post type with author field referencing the schema User
 */
export type Post = {
  id: string;
  title: string;
  /**
   * Reference to schema User - should be a GraphQL reference
   */
  author: User;
  /**
   * Reference to external User - should be expanded as inline object
   * because it's not the same type as schema User
   */
  externalAuthor: ExternalUser;
};

export const posts = defineQuery<NoArgs, Post[]>(() => []);

export const postAuthor = defineField<Post, NoArgs, User>(
  (parent) => parent.author,
);
