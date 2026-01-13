import {
  createGqlkitApis,
  type GqlObject,
  type IDString,
} from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

type Context = unknown;

export type Product = GqlObject<
  {
    id: IDString;
    name: string;
    price: number;
  },
  { implements: [Node] }
>;

const { defineIsTypeOf } = createGqlkitApis<Context>();

export const productIsTypeOf = defineIsTypeOf<Product>((value) => {
  return typeof value === "object" && value !== null && "price" in value;
});
