/**
 * Order status enum with camelCase name.
 */
export type orderStatus =
  | "ORDER_STATUS_PENDING"
  | "ORDER_STATUS_SHIPPED"
  | "ORDER_STATUS_DELIVERED";

export interface Order {
  id: string;
  status: orderStatus;
}
