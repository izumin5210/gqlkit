import {
  defineField,
  defineIsTypeOf,
  defineMutation,
  defineQuery,
  type NoArgs,
} from "../gqlkit.js";

/**
 * User type - named type that will be used in union.
 */
export type User = {
  id: string;
  name: string;
  email: string;
};

/**
 * Post type for field resolver test.
 */
export type Post = {
  id: string;
  title: string;
};

/**
 * CreateUserError type - inline object with __typename for union member.
 * The __typename property value determines the GraphQL type name.
 */
type CreateUserError = {
  __typename: "CreateUserError";
  code: string;
  message: string;
};

/**
 * NotFoundError type - inline object with __typename for union member.
 * The __typename property value determines the GraphQL type name.
 */
type NotFoundError = {
  __typename: "NotFoundError";
  message: string;
  requestedId: string;
};

/**
 * __isTypeOf resolver for User.
 */
export const userIsTypeOf = defineIsTypeOf<User>((value) => {
  return typeof value === "object" && value !== null && "email" in value;
});

/**
 * __isTypeOf resolver for CreateUserError (inline type with __typename).
 */
export const createUserErrorIsTypeOf = defineIsTypeOf<CreateUserError>(
  (value) => {
    return (
      typeof value === "object" &&
      value !== null &&
      "__typename" in value &&
      value.__typename === "CreateUserError"
    );
  },
);

/**
 * __isTypeOf resolver for NotFoundError (inline type with __typename).
 */
export const notFoundErrorIsTypeOf = defineIsTypeOf<NotFoundError>((value) => {
  return (
    typeof value === "object" &&
    value !== null &&
    "__typename" in value &&
    value.__typename === "NotFoundError"
  );
});

/**
 * Query to list posts.
 */
export const posts = defineQuery<NoArgs, Post[]>(() => []);

/**
 * Mixed union test - Mutation returning union of named type + inline type.
 * Expected generated type: CreateUserPayload (GraphQL Union)
 * Union members:
 *   - User (named type - use type name directly)
 *   - CreateUserError (inline type - use __typename value "CreateUserError")
 * Tests requirement 3.4 (union members) and 9.4 (knownTypeNames handling)
 *
 * NOTE: The inline type CreateUserError should generate a GraphQL Object type
 * named "CreateUserError" based on the __typename value.
 */
export const createUser = defineMutation<
  { name: string; email: string },
  User | CreateUserError
>((_root, args) => ({
  id: "1",
  name: args.name,
  email: args.email,
}));

/**
 * Field resolver test with mixed union.
 * Expected generated type: PostAuthorOrErrorPayload (GraphQL Union)
 * Union members:
 *   - User (named type)
 *   - NotFoundError (inline type - use __typename value "NotFoundError")
 *
 * NOTE: The inline type NotFoundError should generate a GraphQL Object type
 * named "NotFoundError" based on the __typename value.
 */
export const authorOrError = defineField<Post, NoArgs, User | NotFoundError>(
  () => ({
    id: "author-1",
    name: "Author",
    email: "author@example.com",
  }),
);
