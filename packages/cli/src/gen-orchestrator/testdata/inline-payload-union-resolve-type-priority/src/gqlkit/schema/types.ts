import {
  defineIsTypeOf,
  defineMutation,
  defineQuery,
  defineResolveType,
  type NoArgs,
} from "../gqlkit.js";

/**
 * User type - named type for success case.
 */
export type User = {
  id: string;
  name: string;
  email: string;
};

/**
 * Post type for query test.
 */
export type Post = {
  id: string;
  title: string;
};

/**
 * CreateUserSuccess type - exported named type for union member.
 * Has __typename field to enable auto-generated resolveType.
 */
export type CreateUserSuccess = {
  __typename: "CreateUserSuccess";
  user: User;
};

/**
 * CreateUserError type - exported named type for union member.
 * Has __typename field to enable auto-generated resolveType.
 */
export type CreateUserError = {
  __typename: "CreateUserError";
  code: string;
  message: string;
};

/**
 * UpdateUserSuccess type - exported named type for union member.
 */
export type UpdateUserSuccess = {
  user: User;
};

/**
 * UpdateUserError type - exported named type for union member.
 */
export type UpdateUserError = {
  code: string;
  message: string;
};

/**
 * __isTypeOf resolvers for CreateUserSuccess.
 */
export const createUserSuccessIsTypeOf = defineIsTypeOf<CreateUserSuccess>(
  (value) => {
    return typeof value === "object" && value !== null && "user" in value;
  },
);

/**
 * __isTypeOf resolvers for CreateUserError.
 */
export const createUserErrorIsTypeOf = defineIsTypeOf<CreateUserError>(
  (value) => {
    return (
      typeof value === "object" &&
      value !== null &&
      "code" in value &&
      !("user" in value)
    );
  },
);

/**
 * __isTypeOf resolvers for UpdateUserSuccess.
 */
export const updateUserSuccessIsTypeOf = defineIsTypeOf<UpdateUserSuccess>(
  (value) => {
    return typeof value === "object" && value !== null && "user" in value;
  },
);

/**
 * __isTypeOf resolvers for UpdateUserError.
 */
export const updateUserErrorIsTypeOf = defineIsTypeOf<UpdateUserError>(
  (value) => {
    return (
      typeof value === "object" &&
      value !== null &&
      "code" in value &&
      !("user" in value)
    );
  },
);

/**
 * Query to fetch posts.
 */
export const posts = defineQuery<NoArgs, Post[]>(() => []);

/**
 * Test case 1: Mutation WITHOUT manual defineResolveType
 *
 * This mutation returns a union of named types (CreateUserSuccess | CreateUserError).
 * Both types have __typename fields, so auto-generated __resolveType is used.
 *
 * Expected: CreateUserPayload uses auto-generated __resolveType: (obj) => obj.__typename
 */
export const createUser = defineMutation<
  { name: string; email: string },
  CreateUserSuccess | CreateUserError
>((_root, args) => ({
  __typename: "CreateUserSuccess" as const,
  user: {
    id: "1",
    name: args.name,
    email: args.email,
  },
}));

/**
 * Union type for UpdateUserPayload.
 * This type is explicitly named to allow defineResolveType to target it.
 */
export type UpdateUserPayload = UpdateUserSuccess | UpdateUserError;

/**
 * Test case 2: Manual defineResolveType takes priority (Requirement 6.4)
 *
 * This defineResolveType is manually defined for UpdateUserPayload.
 * It should take priority over any auto-generated __resolveType.
 *
 * The manual resolveType uses "user" property to determine the type.
 */
export const updateUserPayloadResolveType =
  defineResolveType<UpdateUserPayload>((value) => {
    if ("user" in value) {
      return "UpdateUserSuccess";
    }
    return "UpdateUserError";
  });

/**
 * Test case 2: Mutation WITH manual defineResolveType
 *
 * This mutation uses UpdateUserPayload which has a manual defineResolveType.
 * The manual resolveType takes priority over any auto-generated one.
 *
 * Expected behavior:
 * - CreateUserPayload: uses auto-generated __resolveType: (obj) => obj.__typename
 * - UpdateUserPayload: uses manual updateUserPayloadResolveType (priority over auto)
 */
export const updateUser = defineMutation<
  { id: string; name: string },
  UpdateUserPayload
>((_root, args) => ({
  user: {
    id: args.id,
    name: args.name,
    email: "updated@example.com",
  },
}));
