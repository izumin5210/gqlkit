import type { Product, ProductInput, SearchInput } from "./product.js";

export const product = (
  _root: unknown,
  args: { input: ProductInput },
): Product => {
  void args;
  return { id: "1", name: "Product", price: 100 };
};

export const search = (
  _root: unknown,
  args: { input: SearchInput },
): Product[] => {
  void args;
  return [];
};
