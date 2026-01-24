/**
 * User type with __typename.
 */
export interface User {
  __typename: "User";
  id: string;
  name: string;
}

/**
 * Post type with __typename.
 */
export interface Post {
  __typename: "Post";
  id: string;
  title: string;
}

/**
 * Test case: Union with named types and inline object with __typename.
 * The inline object should be auto-generated as a named GraphQL Object type
 * using the __typename value "Error" as the type name.
 * Expected:
 * - GraphQL Object type "Error" should be generated
 * - resolveType should be auto-generated returning obj.__typename
 */
export type SearchResult =
  | User
  | Post
  | {
      __typename: "Error";
      code: string;
      message: string;
    };
