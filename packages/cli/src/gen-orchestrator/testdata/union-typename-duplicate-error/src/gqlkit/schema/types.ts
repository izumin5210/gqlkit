/**
 * Test case: Duplicate __typename value within same Union (Requirement 4.1)
 *
 * User and Admin have the same __typename value "Person".
 * This should produce a DUPLICATE_TYPENAME_VALUE error.
 */
export interface User {
  __typename: "Person";
  id: string;
  name: string;
}

export interface Admin {
  __typename: "Person";
  id: string;
  role: string;
}

export type SearchResult = User | Admin;
