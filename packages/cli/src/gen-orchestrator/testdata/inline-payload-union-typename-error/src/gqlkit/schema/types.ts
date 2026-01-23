import { defineMutation, defineQuery, type NoArgs } from "../gqlkit.js";

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
 * Query to fetch posts.
 */
export const posts = defineQuery<NoArgs, Post[]>(() => []);

/**
 * Test case 1: Missing __typename property error (Requirement 4.1)
 *
 * This mutation returns a union where one inline member is missing __typename.
 * Expected error: MISSING_TYPENAME_PROPERTY
 * Error message should include:
 * - Union type name: "CreateUserPayload"
 * - Member index: 1 (the inline object without __typename)
 */
export const createUser = defineMutation<
  { name: string },
  | User
  | {
      code: string;
      message: string;
    }
>((_root, args) => ({
  id: "1",
  name: args.name,
  email: "test@example.com",
}));

/**
 * Test case 2: Invalid __typename type error (Requirement 4.2)
 *
 * This mutation returns a union where __typename is not a string literal type.
 * Using `string` instead of a literal like `"UpdateError"`.
 * Expected error: INVALID_TYPENAME_TYPE
 * Error message should include:
 * - Union type name: "UpdateUserPayload"
 * - Member index: 1 (the inline object with invalid __typename)
 */
export const updateUser = defineMutation<
  { id: string; name: string },
  | User
  | {
      __typename: string;
      code: string;
      message: string;
    }
>((_root, args) => ({
  id: args.id,
  name: args.name,
  email: "test@example.com",
}));

/**
 * Test case 3: Multiple errors in one union (Requirement 4.3)
 *
 * This query returns a union where multiple inline members have __typename issues.
 * - First inline member: missing __typename
 * - Second inline member: __typename is not a string literal
 * Expected: Two separate error diagnostics
 */
export const searchItems = defineQuery<
  { query: string },
  | User
  | {
      itemType: string;
      count: number;
    }
  | {
      __typename: string;
      errorType: string;
    }
>((_root, _args) => ({
  id: "1",
  name: "Result",
  email: "result@example.com",
}));

/**
 * Test case 4: Optional __typename property error (Requirement 4.4)
 *
 * This mutation returns a union where __typename is declared as optional.
 * Using `__typename?: "DeleteError"` instead of `__typename: "DeleteError"`.
 * Expected error: OPTIONAL_TYPENAME_PROPERTY
 */
export const deleteUser = defineMutation<
  { id: string },
  | User
  | {
      __typename?: "DeleteError";
      code: string;
      message: string;
    }
>((_root, _args) => ({
  id: "1",
  name: "Deleted",
  email: "deleted@example.com",
}));

/**
 * Test case 5: Nullable __typename property error (Requirement 4.5)
 *
 * This query returns a union where __typename is nullable.
 * Using `__typename: "GetDataError" | null` instead of `__typename: "GetDataError"`.
 * Expected error: NULLABLE_TYPENAME_PROPERTY
 */
export const getData = defineQuery<
  { id: string },
  | User
  | {
      __typename: "GetDataError" | null;
      reason: string;
    }
>((_root, _args) => ({
  id: "1",
  name: "Data",
  email: "data@example.com",
}));

/**
 * Test case 6: __typename field structure mismatch error (Requirement 4.6)
 *
 * This test uses the SAME __typename value "SharedError" in two different
 * union members, but with DIFFERENT field structures.
 * Expected error: TYPENAME_FIELD_STRUCTURE_MISMATCH
 */
export const processA = defineQuery<
  NoArgs,
  | User
  | {
      __typename: "SharedError";
      code: string;
      message: string;
    }
>((_root, _args) => ({
  id: "1",
  name: "A",
  email: "a@example.com",
}));

export const processB = defineQuery<
  NoArgs,
  | User
  | {
      __typename: "SharedError";
      code: string;
      reason: string;
    }
>((_root, _args) => ({
  id: "1",
  name: "B",
  email: "b@example.com",
}));
