/**
 * Test case: Schema-wide duplicate __typename values (Requirement 4.7)
 *
 * User and Admin are separate object types but both have __typename "Person".
 * Even though they are not in the same Union, this is a schema-wide conflict.
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

export interface Post {
  __typename: "Post";
  id: string;
  title: string;
}

export type UserResult = User | Post;
export type AdminResult = Admin | Post;
