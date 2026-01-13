import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Category, Product } from "./types.js";

export const products = defineQuery<NoArgs, Product[]>(() => []);

export const product = defineQuery<{ id: string }, Product | null>(
  (_root, args) => ({
    id: args.id,
    name: "Test Product",
    price: 100,
  }),
);

export const categories = defineQuery<NoArgs, Category[]>(() => []);
