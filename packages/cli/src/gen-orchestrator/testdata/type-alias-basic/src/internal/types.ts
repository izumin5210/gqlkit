export interface InternalProduct {
  id: string;
  name: string;
  price: number | null;
}

export interface InternalCreateProductInput {
  name: string;
  price?: number;
}
