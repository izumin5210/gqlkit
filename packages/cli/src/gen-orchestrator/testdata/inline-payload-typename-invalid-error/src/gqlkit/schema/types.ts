import { defineMutation } from "../gqlkit.js";

/**
 * User type - named type for success case.
 */
export type User = {
  id: string;
  name: string;
};

/**
 * Test: INVALID_TYPENAME_TYPE error
 *
 * This mutation returns a union where __typename is not a string literal type.
 * Using `string` instead of a literal like `"UpdateError"`.
 * Expected error: INVALID_TYPENAME_TYPE
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
}));
