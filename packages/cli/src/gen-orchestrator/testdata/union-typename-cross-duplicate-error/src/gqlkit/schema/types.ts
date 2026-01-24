/**
 * Test case: Cross-duplicate between __typename and $typeName (Requirement 4.3)
 *
 * User has __typename "Entity" and Admin has $typeName "Entity".
 * This should produce a DUPLICATE_TYPENAME_VALUE error.
 */
export interface User {
  __typename: "Entity";
  id: string;
  name: string;
}

export interface Admin {
  $typeName: "Entity";
  id: string;
  role: string;
}

export type SearchResult = User | Admin;
