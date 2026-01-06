import type { Int } from "@gqlkit-ts/runtime";

/**
 * Product location within the warehouse
 */
export interface ProductLocationInput {
  aisleNumber: Int;
  shelfNumber: Int;
  positionOnShelf: Int;
}

/**
 * Specifies how to identify a product.
 * Exactly one field must be provided.
 */
export type ProductInput =
  | { id: string }
  | { name: string }
  | { location: ProductLocationInput };

/**
 * Search by various criteria
 */
export type SearchInput =
  | { query: string }
  | { categoryId: string }
  | { priceMax: number };

export interface Product {
  id: string;
  name: string;
  price: number;
}
