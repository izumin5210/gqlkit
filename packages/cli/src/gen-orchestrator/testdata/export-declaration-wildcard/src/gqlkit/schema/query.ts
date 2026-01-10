import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { Order, OrderItem, OrderStatus, PaymentMethod } from "./types.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const orders = defineQuery<NoArgs, Order[]>(() => []);

export const order = defineQuery<{ id: string }, Order | null>(
  (_root, args) => ({
    id: args.id,
    total: 100,
    createdAt: "2024-01-01",
  }),
);

export const orderItems = defineQuery<{ orderId: string }, OrderItem[]>(
  (_root, _args) => [],
);

export const orderStatus = defineQuery<{ orderId: string }, OrderStatus>(
  (_root, _args) => "PENDING",
);

export const paymentMethod = defineQuery<{ orderId: string }, PaymentMethod>(
  (_root, _args) => "CASH" as PaymentMethod,
);
