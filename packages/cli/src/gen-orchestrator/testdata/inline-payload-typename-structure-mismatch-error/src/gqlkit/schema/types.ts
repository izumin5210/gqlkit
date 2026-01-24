import { defineQuery, type NoArgs } from "../gqlkit.js";

/**
 * User type - named type for success case.
 */
export type User = {
  id: string;
  name: string;
};

/**
 * Test: TYPENAME_FIELD_STRUCTURE_MISMATCH error
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
}));
