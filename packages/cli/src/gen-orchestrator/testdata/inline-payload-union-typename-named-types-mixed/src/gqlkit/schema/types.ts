import { defineQuery } from "../gqlkit.js";

/**
 * Success result type with __typename
 */
export interface GetUserSuccess {
  __typename: "GetUserSuccess";
  user: {
    id: string;
    name: string;
  };
}

/**
 * Error result type with $typeName (gqlkit-specific alternative)
 */
export interface GetUserNotFoundError {
  $typeName: "GetUserNotFoundError";
  message: string;
  requestedId: string;
}

/**
 * Query returning union of named types with mixed typename fields.
 * One member uses __typename, another uses $typeName.
 * Expected: resolveType should be auto-generated as `obj.__typename ?? obj.$typeName`.
 */
export const getUser = defineQuery<
  { id: string },
  GetUserSuccess | GetUserNotFoundError
>((_root, args) => ({
  __typename: "GetUserSuccess" as const,
  user: {
    id: args.id,
    name: "Test User",
  },
}));
