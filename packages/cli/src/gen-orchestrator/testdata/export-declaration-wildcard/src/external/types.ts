/**
 * External order type (simulating protobuf-es or Prisma generated type)
 */
export interface Order {
  id: string;
  total: number;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
}

export type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED";
