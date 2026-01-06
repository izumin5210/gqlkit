import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = unknown;

interface Product {
  id: string;
  name: string;
  status: string;
}

interface SearchInput {
  status: string;
  tags: string[];
  origin: { x: number; y: number };
  scores: number[];
}

const { defineQuery } = createGqlkitApis<Context>();

export const searchProducts = defineQuery<{ input: SearchInput }, Product[]>(
  (_root, _args) => [],
);
