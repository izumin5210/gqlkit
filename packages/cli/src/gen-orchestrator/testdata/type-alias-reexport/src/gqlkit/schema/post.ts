import type { NoArgs } from "@gqlkit-ts/runtime";
// Import ExternalUser directly from external package
import type { ExternalUser } from "../../external/types.js";
import { defineQuery } from "../gqlkit.js";
// Import User from schema (which is a re-export of ExternalUser)
// Also test alias import: User as AliasedUser
import type { User as AliasedUser, User } from "./user.js";

/**
 * Post type demonstrating various import patterns
 */
export type Post = {
  id: string;
  title: string;
  /**
   * Uses schema User directly
   */
  author: User;
  /**
   * Uses schema User via alias import - should still be recognized as User
   */
  aliasedAuthor: AliasedUser;
  /**
   * Uses ExternalUser directly - should also be recognized as User
   * because schema User is a type alias of ExternalUser
   */
  externalAuthor: ExternalUser;
};

export const posts = defineQuery<NoArgs, Post[]>(() => []);
