import type { DefineInterface, GqlTypeDef, IDString } from "@gqlkit-ts/runtime";

/**
 * Node interface - represents any entity with a unique identifier.
 */
export type Node = DefineInterface<{
  id: IDString;
}>;

/**
 * User type that implements Node.
 */
export type User = GqlTypeDef<
  {
    id: IDString;
    name: string;
  },
  { implements: [Node] }
>;

/**
 * Post type that implements Node.
 */
export type Post = GqlTypeDef<
  {
    id: IDString;
    title: string;
  },
  { implements: [Node] }
>;

/**
 * Union type of User and Post (both implementing Node via GqlTypeDef).
 */
export type SearchResult = User | Post;
