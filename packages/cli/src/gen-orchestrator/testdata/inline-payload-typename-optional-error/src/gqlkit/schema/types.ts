import { defineMutation } from "../gqlkit.js";

/**
 * User type - named type for success case.
 */
export type User = {
  id: string;
  name: string;
};

/**
 * Test: OPTIONAL_TYPENAME_PROPERTY error
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
}));
