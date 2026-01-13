import {
  createGqlkitApis,
  type GqlInterface,
  type GqlObject,
  type IDString,
} from "@gqlkit-ts/runtime";

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

type Context = unknown;
const { defineResolveType } = createGqlkitApis<Context>();

export const nodeResolveType = defineResolveType<Node>((value) => {
  if ("name" in value) return "User";
  return "Post";
});

export const searchResultResolveType = defineResolveType<SearchResult>(
  (value) => {
    if ("name" in value) return "User";
    return "Post";
  },
);
