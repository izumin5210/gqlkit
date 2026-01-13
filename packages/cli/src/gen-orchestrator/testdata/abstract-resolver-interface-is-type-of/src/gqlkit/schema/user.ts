import {
  createGqlkitApis,
  type GqlObject,
  type IDString,
} from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

type Context = unknown;

export type User = GqlObject<
  {
    id: IDString;
    name: string;
  },
  { implements: [Node] }
>;

const { defineIsTypeOf } = createGqlkitApis<Context>();

export const userIsTypeOf = defineIsTypeOf<User>((value) => {
  return typeof value === "object" && value !== null && "name" in value;
});
