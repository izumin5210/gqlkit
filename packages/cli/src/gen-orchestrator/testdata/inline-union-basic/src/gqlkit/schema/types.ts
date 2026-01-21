import { defineIsTypeOf } from "../gqlkit.js";

/**
 * User type - known type for reference testing
 */
export type User = {
  id: string;
  name: string;
  email: string;
};

/**
 * Post type - known type for reference testing
 */
export type Post = {
  id: string;
  title: string;
  content: string;
};

/**
 * A search result that contains an inline union field.
 * Tests basic inline union with knownTypeNames members preserved as references.
 */
export type SearchResult = {
  id: string;
  /**
   * The matched item - either a User or a Post (both are knownTypeNames)
   */
  item: User | Post;
};

/**
 * Container with nullable inline union field.
 * Tests nullable inline union processing.
 */
export type Container = {
  id: string;
  /**
   * Optional result - nullable inline union with known types
   */
  result: User | Post | null;
};

export const userIsTypeOf = defineIsTypeOf<User>((value) => {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "email" in value
  );
});

export const postIsTypeOf = defineIsTypeOf<Post>((value) => {
  return (
    typeof value === "object" &&
    value !== null &&
    "title" in value &&
    "content" in value
  );
});
