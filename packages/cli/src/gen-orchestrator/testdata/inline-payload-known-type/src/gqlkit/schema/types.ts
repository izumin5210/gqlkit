import {
  defineField,
  defineIsTypeOf,
  defineMutation,
  defineQuery,
  defineResolveType,
  type NoArgs,
} from "../gqlkit.js";

/**
 * User type - explicitly defined named type.
 * When used directly as return type, no Payload should be generated.
 */
export type User = {
  id: string;
  name: string;
  email: string;
};

/**
 * Error type for user operations.
 */
export type UserError = {
  code: string;
  message: string;
};

/**
 * Explicitly defined union type.
 * When used directly as return type, no Payload should be generated.
 */
export type UserResult = User | UserError;

/**
 * Explicitly defined string enum.
 * When used directly as return type, no Payload should be generated.
 */
export const Status = {
  Active: "active",
  Inactive: "inactive",
  Pending: "pending",
} as const;
export type Status = (typeof Status)[keyof typeof Status];

/**
 * Post type with status field.
 */
export type Post = {
  id: string;
  title: string;
};

/**
 * __isTypeOf resolver for User.
 */
export const userIsTypeOf = defineIsTypeOf<User>((value) => {
  return typeof value === "object" && value !== null && "email" in value;
});

/**
 * __isTypeOf resolver for UserError.
 */
export const userErrorIsTypeOf = defineIsTypeOf<UserError>((value) => {
  return typeof value === "object" && value !== null && "code" in value;
});

/**
 * __resolveType resolver for UserResult union.
 */
export const userResultResolveType = defineResolveType<UserResult>((value) => {
  if ("email" in value) {
    return "User";
  }
  return "UserError";
});

/**
 * Query returning a known type directly.
 * No Payload type should be generated - User type is used directly.
 * Tests requirement 6.1 (knownTypeNames skip).
 */
export const getUser = defineQuery<{ id: string }, User>((_root, args) => ({
  id: args.id,
  name: "Test User",
  email: "test@example.com",
}));

/**
 * Query returning a known union type directly.
 * No Payload type should be generated - UserResult union is used directly.
 * Tests requirement 6.1 (knownTypeNames skip for union).
 */
export const getUserResult = defineQuery<{ id: string }, UserResult>(
  (_root, args) => ({
    id: args.id,
    name: "Test User",
    email: "test@example.com",
  }),
);

/**
 * Mutation returning a known type directly.
 * No Payload type should be generated - User type is used directly.
 * Tests requirement 6.1 for mutation.
 */
export const createUser = defineMutation<{ name: string; email: string }, User>(
  (_root, args) => ({
    id: "1",
    name: args.name,
    email: args.email,
  }),
);

/**
 * Query returning a nullable known type.
 * No Payload type should be generated - nullable User is still a known type.
 * Tests requirement 6.1 for nullable reference.
 */
export const findUser = defineQuery<{ email: string }, User | null>(
  (_root, _args) => null,
);

/**
 * Query returning an array of known type.
 * No Payload type should be generated - array of User is still based on known type.
 * Tests requirement 6.1 for array reference.
 */
export const listUsers = defineQuery<NoArgs, User[]>(() => []);

/**
 * Query to list posts.
 */
export const posts = defineQuery<NoArgs, Post[]>(() => []);

/**
 * Field resolver returning a known type directly.
 * No Payload type should be generated - User type is used directly.
 * Tests requirement 6.1 for field resolver.
 */
export const author = defineField<Post, NoArgs, User>(() => ({
  id: "author-1",
  name: "Author",
  email: "author@example.com",
}));

/**
 * Field resolver returning a known enum type directly.
 * No Payload type should be generated - Status enum is used directly.
 * Tests requirement 6.1 for enum reference.
 */
export const status = defineField<Post, NoArgs, Status>(() => "active");

/**
 * Query returning inline object for comparison.
 * This SHOULD generate a Payload type (CompareInlinePayload).
 * Demonstrates the contrast with known type handling.
 */
export const compareInline = defineQuery<
  NoArgs,
  {
    success: boolean;
    data: User;
  }
>(() => ({
  success: true,
  data: { id: "1", name: "Test", email: "test@example.com" },
}));
