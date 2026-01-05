/**
 * Filter product by ID
 */
export interface ByIdInput {
  id: string;
}

/**
 * Filter product by name
 * @deprecated Use ByIdInput instead
 */
export interface ByNameInput {
  name: string;
}

/**
 * Specifies how to identify a product.
 * Exactly one field must be provided.
 */
export type ProductInput = ByIdInput | ByNameInput;

export interface Product {
  id: string;
  name: string;
  price: number;
}
