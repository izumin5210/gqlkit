export interface User {
  __typename: "User";
  id: string;
  name: string;
}

export interface Post {
  __typename: "Post";
  id: string;
  title: string;
}

/**
 * Test case: Union with inline object missing __typename
 * When a Union contains inline objects, ALL members must have __typename or $typeName.
 * This inline object is missing __typename, so an error should be reported.
 * Expected error: MISSING_TYPENAME_PROPERTY
 */
export type SearchResult =
  | User
  | Post
  | {
      code: string;
      message: string;
    };
