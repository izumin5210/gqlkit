import type { GqlInterface, GqlObject } from "../gqlkit.js";

/**
 * Test case: Duplicate __typename value within same Interface (Requirement 4.4)
 *
 * User and Admin both implement Node but have the same __typename value "Person".
 * This should produce a DUPLICATE_TYPENAME_VALUE error.
 */
export type Node = GqlInterface<{
  id: string;
}>;

export type User = GqlObject<
  {
    __typename: "Person";
    id: string;
    name: string;
  },
  { implements: [Node] }
>;

export type Admin = GqlObject<
  {
    __typename: "Person";
    id: string;
    role: string;
  },
  { implements: [Node] }
>;
