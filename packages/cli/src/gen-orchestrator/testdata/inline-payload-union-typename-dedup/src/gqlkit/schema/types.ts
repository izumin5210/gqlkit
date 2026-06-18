import { defineIsTypeOf, defineMutation, defineQuery } from "../gqlkit.js";

/**
 * User type - named type for success case.
 */
export type User = {
  id: string;
  name: string;
  email: string;
};

/**
 * Post type - named type for success case.
 */
export type Post = {
  id: string;
  title: string;
};

/**
 * SharedError type - inline object with __typename that will be used
 * in MULTIPLE unions. This tests Requirement 5.4: duplicate prevention.
 * Only ONE GraphQL Object type named "SharedError" should be generated.
 */
type SharedError = {
  __typename: "SharedError";
  code: string;
  message: string;
};

/**
 * ValidationError type - another inline object with __typename.
 * Used in createUser mutation.
 */
type ValidationError = {
  __typename: "ValidationError";
  field: string;
  message: string;
};

/**
 * __isTypeOf resolver for User.
 */
export const userIsTypeOf = defineIsTypeOf<User>((value) => {
  return typeof value === "object" && value !== null && "email" in value;
});

/**
 * __isTypeOf resolver for Post.
 */
export const postIsTypeOf = defineIsTypeOf<Post>((value) => {
  return typeof value === "object" && value !== null && "title" in value;
});

/**
 * __isTypeOf resolver for SharedError.
 */
export const sharedErrorIsTypeOf = defineIsTypeOf<SharedError>((value) => {
  return (
    typeof value === "object" &&
    value !== null &&
    "__typename" in value &&
    value.__typename === "SharedError"
  );
});

/**
 * __isTypeOf resolver for ValidationError.
 */
export const validationErrorIsTypeOf = defineIsTypeOf<ValidationError>(
  (value) => {
    return (
      typeof value === "object" &&
      value !== null &&
      "__typename" in value &&
      value.__typename === "ValidationError"
    );
  },
);

/**
 * Query returning union with SharedError.
 * Expected generated type: GetUserPayload (GraphQL Union)
 * Union members: User | SharedError
 * The SharedError type should be generated from __typename value.
 */
export const getUser = defineQuery<{ id: string }, User | SharedError>(
  (_root, args) => ({
    id: args.id,
    name: "Test User",
    email: "test@example.com",
  }),
);

/**
 * Another query returning union with the SAME SharedError type.
 * Expected generated type: GetPostPayload (GraphQL Union)
 * Union members: Post | SharedError
 *
 * IMPORTANT: This tests Requirement 5.4 - since SharedError has the same
 * __typename value as in getUser, it should NOT generate a duplicate
 * GraphQL Object type. The existing SharedError type should be reused.
 */
export const getPost = defineQuery<{ id: string }, Post | SharedError>(
  (_root, args) => ({
    id: args.id,
    title: "Test Post",
  }),
);

/**
 * Mutation returning union with SharedError AND a different inline type.
 * Expected generated type: CreateUserPayload (GraphQL Union)
 * Union members: User | SharedError | ValidationError
 *
 * This tests:
 * - SharedError should still be reused (not duplicated)
 * - ValidationError is a new inline type with its own __typename
 */
export const createUser = defineMutation<
  { name: string; email: string },
  User | SharedError | ValidationError
>((_root, args) => ({
  id: "1",
  name: args.name,
  email: args.email,
}));
