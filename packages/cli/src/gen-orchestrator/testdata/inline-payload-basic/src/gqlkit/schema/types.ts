import { defineField, defineMutation, defineQuery } from "../gqlkit.js";

export type User = {
  id: string;
  name: string;
};

export type Post = {
  id: string;
  title: string;
};

/**
 * Query returning an inline object type (creates CreateUserPayload)
 */
export const createUser = defineMutation<
  { name: string },
  {
    /** The created user */
    user: User;
    /** Operation success flag */
    success: boolean;
  }
>((_root, args) => ({
  user: { id: "1", name: args.name },
  success: true,
}));

/**
 * Query returning inline enum (string literal union)
 */
export const getUserStatus = defineQuery<
  { userId: string },
  "active" | "inactive" | "suspended"
>((_root, _args) => "active");

/**
 * Mutation returning inline union of named types
 */
export const updatePost = defineMutation<
  { id: string; title: string },
  User | Post
>((_root, _args) => ({
  id: "1",
  title: "Updated",
}));

/**
 * Field resolver returning inline object with TSDoc and @deprecated
 */
export const stats = defineField<
  User,
  Record<string, never>,
  {
    /** Total post count */
    postCount: number;
    /** Total comment count */
    commentCount: number;
    /**
     * Legacy follower count
     * @deprecated Use socialStats.followers instead
     */
    followerCount: number | null;
  }
>((_parent, _args) => ({
  postCount: 10,
  commentCount: 5,
  followerCount: null,
}));

/**
 * Utility type test - Omit should be expanded to inline object
 */
type FullUserProfile = {
  id: string;
  name: string;
  email: string;
  password: string;
};

export const getUserProfile = defineQuery<
  { userId: string },
  Omit<FullUserProfile, "password">
>((_root, _args) => ({
  id: "1",
  name: "Test",
  email: "test@example.com",
}));
