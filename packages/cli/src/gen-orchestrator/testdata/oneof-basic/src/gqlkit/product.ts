export interface ByIdInput {
  id: string;
}

export interface ByNameInput {
  name: string;
}

export type ProductInput = ByIdInput | ByNameInput;

export interface Product {
  id: string;
  name: string;
  price: number;
}
