import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import { defineIsTypeOf } from "../gqlkit.js";
import type { Node } from "./node.js";

export type Product = GqlObject<
  {
    id: IDString;
    name: string;
    price: number;
  },
  { implements: [Node] }
>;

export const productIsTypeOf = defineIsTypeOf<Product>((value) => {
  return typeof value === "object" && value !== null && "price" in value;
});
