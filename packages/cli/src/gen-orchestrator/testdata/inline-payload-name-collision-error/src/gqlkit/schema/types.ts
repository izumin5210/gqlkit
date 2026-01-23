import { defineField, defineMutation } from "../gqlkit.js";

export type User = {
  id: string;
  name: string;
};

/**
 * Mutation returning inline object that will generate CreateUserPayload.
 */
export const createUser = defineMutation<
  { name: string },
  {
    user: User;
    success: boolean;
  }
>((_root, args) => ({
  user: { id: "1", name: args.name },
  success: true,
}));

/**
 * Explicit CreateUserPayload type that conflicts with auto-generated Payload.
 * This should cause a type name collision error.
 */
export type CreateUserPayload = {
  result: User;
  message: string;
};

/**
 * Field resolver returning inline object that will generate UserStatsPayload.
 */
export const stats = defineField<
  User,
  Record<string, never>,
  {
    postCount: number;
    commentCount: number;
  }
>((_parent, _args) => ({
  postCount: 10,
  commentCount: 5,
}));

/**
 * Explicit UserStatsPayload type that conflicts with auto-generated Payload.
 * This should cause a type name collision error.
 */
export type UserStatsPayload = {
  totalPosts: number;
  totalComments: number;
};
