import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import { defineIsTypeOf } from "../gqlkit.js";
import type { Node } from "./node.js";

export type Post = GqlObject<
  {
    id: IDString;
    title: string;
  },
  { implements: [Node] }
>;

export const postIsTypeOf = defineIsTypeOf<Post>((value) => {
  return typeof value === "object" && value !== null && "title" in value;
});
