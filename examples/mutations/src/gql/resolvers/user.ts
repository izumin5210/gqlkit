import { defineMutation, defineQuery, type NoArgs } from "@gqlkit-ts/runtime";
import type { User } from "../types/user.js";

export const users = defineQuery<NoArgs, User[]>(() => [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
]);

export const createUser = defineMutation<{ name: string; email: string }, User>(
  (_root, args) => ({
    id: crypto.randomUUID(),
    name: args.name,
    email: args.email,
  }),
);

export const updateUser = defineMutation<
  { id: string; name: string | null },
  User | null
>((_root, args) => ({
  id: args.id,
  name: args.name ?? "Unknown",
  email: "updated@example.com",
}));

export const deleteUser = defineMutation<{ id: string }, boolean>(() => true);
