import type { GqlInterface, GqlObject, IDString } from "@gqlkit-ts/runtime";

export interface Article {
  id: string;
  title: string;
  content: string;
}

export interface Video {
  id: string;
  title: string;
  duration: number;
}

export type SearchResult = Article | Video;

export type Node = GqlInterface<{
  id: IDString;
}>;

export type User = GqlObject<
  {
    id: IDString;
    name: string;
  },
  { implements: [Node] }
>;

export type Product = GqlObject<
  {
    id: IDString;
    price: number;
  },
  { implements: [Node] }
>;
