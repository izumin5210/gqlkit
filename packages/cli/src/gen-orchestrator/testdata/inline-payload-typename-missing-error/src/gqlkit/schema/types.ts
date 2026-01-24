import { defineMutation } from "../gqlkit.js";

/**
 * User type - named type for success case.
 */
export type User = {
  id: string;
  name: string;
};

/**
 * Test: MISSING_TYPENAME_PROPERTY error
 *
 * This mutation returns a union where one inline member is missing __typename.
 * Expected error: MISSING_TYPENAME_PROPERTY
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
}));
