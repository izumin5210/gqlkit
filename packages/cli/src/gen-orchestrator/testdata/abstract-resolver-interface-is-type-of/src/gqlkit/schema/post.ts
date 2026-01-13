import {
  createGqlkitApis,
  type GqlObject,
  type IDString,
} from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

type Context = unknown;

export type Post = GqlObject<
  {
    id: IDString;
    title: string;
  },
  { implements: [Node] }
>;

const { defineIsTypeOf } = createGqlkitApis<Context>();

export const postIsTypeOf = defineIsTypeOf<Post>((value) => {
  return typeof value === "object" && value !== null && "title" in value;
});
