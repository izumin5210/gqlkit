import { defineQuery, defineMutation, defineField } from "../gqlkit.js";

export type User = {
  id: string;
  name: string;
};

export type Post = {
  id: string;
  title: string;
  authorId: string;
};

/**
 * Query with inline oneOf inside inline object argument.
 * Tests Query arg naming convention with nested field path.
 */
export const findUser = defineQuery<
  {
    /**
     * Search criteria for finding user
     */
    criteria: {
      /**
       * Find by identifier - either ID or email
       */
      identifier: { id: string } | { email: string };
    };
  },
  User | null
>((_root, args) => {
  void args;
  return null;
});

/**
 * Mutation with inline oneOf inside inline object argument.
 * Tests Mutation arg naming convention with nested field path.
 */
export const createPost = defineMutation<
  {
    /**
     * Post input data
     */
    input: {
      title: string;
      content: string;
      /**
       * Post target - either a user or a topic
       */
      target: { userId: string } | { topicId: string };
    };
  },
  Post
>((_root, args) => ({
  id: "1",
  title: args.input.title,
  authorId: "1",
}));

/**
 * Field resolver with inline oneOf inside inline object argument.
 * Tests Field arg naming convention with parent type and nested field path.
 */
export const posts = defineField<
  User,
  {
    /**
     * Filter options for posts
     */
    options: {
      /**
       * Filter by status or date
       */
      filter: { status: string } | { createdAfter: string } | null;
    } | null;
  },
  Post[]
>((parent, args) => {
  void parent;
  void args;
  return [];
});
