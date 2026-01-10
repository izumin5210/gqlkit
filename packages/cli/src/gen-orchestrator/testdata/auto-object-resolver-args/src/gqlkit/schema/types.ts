import {
  createGqlkitApis,
  type GqlField,
  type NoArgs,
} from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery, defineMutation, defineField } =
  createGqlkitApis<Context>();

export type User = {
  id: string;
  name: string;
};

/**
 * Simple query without arguments for testing
 */
export const allUsers = defineQuery<NoArgs, User[]>(() => []);

export type Post = {
  id: string;
  title: string;
  authorId: string;
};

/**
 * Create a new user with inline input object
 */
export const createUser = defineMutation<
  {
    /** User's profile data */
    data: {
      /** User's name */
      name: string;
      /** User's email */
      email: string | null;
    };
  },
  User
>((_root, args) => ({
  id: "1",
  name: args.data.name,
}));

/**
 * Query to search users
 */
export const searchUsers = defineQuery<
  {
    /** Search filter */
    filter: {
      /** Filter by name pattern */
      namePattern: string | null;
      /** Minimum age */
      minAge?: number;
    };
    /** Pagination options */
    pagination: {
      /** Page number */
      page: GqlField<number, { defaultValue: 1 }>;
      /** Items per page */
      limit: GqlField<number, { defaultValue: 10 }>;
    };
  },
  User[]
>((_root, args) => []);

/**
 * Field resolver with inline args for User.posts
 */
export const posts = defineField<
  User,
  {
    /** Filter options */
    filter: {
      /** Filter by title pattern */
      titlePattern: string | null;
    } | null;
  },
  Post[]
>((parent, args) => []);
