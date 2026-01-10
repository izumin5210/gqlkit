import type { GqlInterface, GqlObject, IDString } from "@gqlkit-ts/runtime";

/**
 * Node interface - represents any entity with a unique identifier.
 */
export type Node = GqlInterface<{
  id: IDString;
}>;

/**
 * User type that implements Node.
 */
export type User = GqlObject<
  {
    id: IDString;
    name: string;
  },
  { implements: [Node] }
>;

/**
 * Post type that implements Node.
 */
export type Post = GqlObject<
  {
    id: IDString;
    title: string;
  },
  { implements: [Node] }
>;

/**
 * Union type of User and Post (both implementing Node via GqlObject).
 */
export type SearchResult = User | Post;
