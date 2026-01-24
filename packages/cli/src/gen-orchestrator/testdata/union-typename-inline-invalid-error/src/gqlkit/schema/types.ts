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
 * Test case: Union with inline object having invalid __typename type
 * When a Union contains inline objects, __typename must be a string literal type.
 * This inline object has __typename as string (not a literal), so an error should be reported.
 * Expected error: INVALID_TYPENAME_TYPE
 */
export type SearchResult =
  | User
  | Post
  | {
      __typename: string;
      code: string;
      message: string;
    };
