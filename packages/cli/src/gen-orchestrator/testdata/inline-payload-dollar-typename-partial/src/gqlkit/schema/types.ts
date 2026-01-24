import {
  defineField,
  defineIsTypeOf,
  defineMutation,
  defineQuery,
  type NoArgs,
} from "../gqlkit.js";

/** User type. */
export type User = {
  id: string;
  name: string;
  email: string;
};

/** Post type. */
export type Post = {
  id: string;
  title: string;
};

/** CreateUserError with $typeName field. */
type CreateUserError = {
  $typeName: "CreateUserError";
  code: string;
  message: string;
};

/** NotFoundError with $typeName field. */
type NotFoundError = {
  $typeName: "NotFoundError";
  message: string;
  requestedId: string;
};

/** __isTypeOf resolver for User. */
export const userIsTypeOf = defineIsTypeOf<User>((value) => {
  return typeof value === "object" && value !== null && "email" in value;
});

/** __isTypeOf resolver for CreateUserError. */
export const createUserErrorIsTypeOf = defineIsTypeOf<CreateUserError>(
  (value) => {
    return (
      typeof value === "object" &&
      value !== null &&
      "$typeName" in value &&
      value.$typeName === "CreateUserError"
    );
  },
);

/** __isTypeOf resolver for NotFoundError. */
export const notFoundErrorIsTypeOf = defineIsTypeOf<NotFoundError>((value) => {
  return (
    typeof value === "object" &&
    value !== null &&
    "$typeName" in value &&
    value.$typeName === "NotFoundError"
  );
});

/** Returns all posts. */
export const posts = defineQuery<NoArgs, Post[]>(() => []);

/** Creates a user. */
export const createUser = defineMutation<
  { name: string; email: string },
  User | CreateUserError
>((_root, args) => ({
  id: "1",
  name: args.name,
  email: args.email,
}));

/** Fetches post author. */
export const authorOrError = defineField<Post, NoArgs, User | NotFoundError>(
  () => ({
    id: "author-1",
    name: "Author",
    email: "author@example.com",
  }),
);
