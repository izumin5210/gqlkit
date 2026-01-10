import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { Category, Product } from "./types.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const products = defineQuery<NoArgs, Product[]>(() => []);

export const product = defineQuery<{ id: string }, Product | null>(
  (_root, args) => ({
    id: args.id,
    name: "Test Product",
    price: 100,
  }),
);

export const categories = defineQuery<NoArgs, Category[]>(() => []);
