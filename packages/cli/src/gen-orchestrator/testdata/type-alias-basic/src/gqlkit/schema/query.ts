import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineMutation, defineQuery } from "../gqlkit.js";
import type {
  CreateProductInput,
  CreateUserInput,
  Product,
  User,
} from "./types.js";

export const user = defineQuery<{ id: string }, User | null>((_root, args) => {
  return { id: args.id, name: "Test User", email: null };
});

export const users = defineQuery<NoArgs, User[]>(() => {
  return [];
});

export const product = defineQuery<{ id: string }, Product | null>(
  (_root, args) => {
    return { id: args.id, name: "Test Product", price: 100 };
  },
);

export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  (_root, args) => {
    return { id: "1", name: args.input.name, email: args.input.email ?? null };
  },
);

export const createProduct = defineMutation<
  { input: CreateProductInput },
  Product
>((_root, args) => {
  return { id: "1", name: args.input.name, price: args.input.price ?? null };
});
