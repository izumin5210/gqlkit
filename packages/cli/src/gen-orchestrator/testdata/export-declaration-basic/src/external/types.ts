/**
 * External product type (simulating protobuf-es or Prisma generated type)
 */
export interface Product {
  id: string;
  name: string;
  price: number | null;
}

export interface Category {
  id: string;
  name: string;
}
