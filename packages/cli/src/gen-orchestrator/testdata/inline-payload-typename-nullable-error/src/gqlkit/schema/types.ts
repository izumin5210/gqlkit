import { defineQuery } from "../gqlkit.js";

/**
 * User type - named type for success case.
 */
export type User = {
  id: string;
  name: string;
};

/**
 * Test: NULLABLE_TYPENAME_PROPERTY error
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
}));
