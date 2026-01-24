import { defineMutation, defineQuery } from "../gqlkit.js";

/**
 * Success result type with __typename
 */
export interface CreateUserSuccess {
  __typename: "CreateUserSuccess";
  user: {
    id: string;
    name: string;
  };
}

/**
 * Error result type with __typename
 */
export interface CreateUserInvalidEmailError {
  __typename: "CreateUserInvalidEmailError";
  message: string;
  email: string;
}

/**
 * Mutation returning union of named types, all with __typename.
 * Expected: resolveType should be auto-generated from __typename fields.
 */
export const createUser = defineMutation<
  { input: { name: string; email: string } },
  CreateUserSuccess | CreateUserInvalidEmailError
>((_root, args) => ({
  __typename: "CreateUserSuccess" as const,
  user: {
    id: "1",
    name: args.input.name,
  },
}));

/**
 * Another error type with __typename
 */
export interface GetUserNotFoundError {
  __typename: "GetUserNotFoundError";
  message: string;
  requestedId: string;
}

/**
 * Query returning union of named types, all with __typename.
 * Expected: resolveType should be auto-generated from __typename fields.
 */
export const getUser = defineQuery<
  { id: string },
  CreateUserSuccess | GetUserNotFoundError
>((_root, args) => ({
  __typename: "CreateUserSuccess" as const,
  user: {
    id: args.id,
    name: "Test User",
  },
}));
