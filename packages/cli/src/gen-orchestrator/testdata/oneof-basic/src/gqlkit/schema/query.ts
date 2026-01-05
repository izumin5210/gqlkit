import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { Product, ProductInput } from "./product.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const product = defineQuery<{ input: ProductInput }, Product>(
  (_root, _args) => ({
    id: "1",
    name: "Product",
    price: 100,
  }),
);
