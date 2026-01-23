import type { GqlInterface, GqlObject } from "../gqlkit.js";

export type Node = GqlInterface<{
  id: string;
}>;

export type User = GqlObject<
  {
    __typename: "User";
    id: string;
    name: string;
  },
  { implements: [Node] }
>;

export type Post = GqlObject<
  {
    $typeName: "Post";
    id: string;
    title: string;
  },
  { implements: [Node] }
>;
