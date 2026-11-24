import type { GqlInterface, GqlObject, IDString } from "@gqlkit-ts/runtime";

export type Node = GqlInterface<{
  id: IDString;
}>;

/**
 * Lists only its direct parent; Node is inherited through Entity.
 */
export type Content = GqlInterface<
  {
    id: IDString;
    title: string;
  },
  { implements: [Entity] }
>;

export type Entity = GqlInterface<
  {
    id: IDString;
  },
  { implements: [Node] }
>;

export type Article = GqlObject<
  {
    __typename: "Article";
    id: IDString;
    title: string;
  },
  { implements: [Content] }
>;

export type User = GqlObject<
  {
    __typename: "User";
    id: IDString;
  },
  { implements: [Entity] }
>;
