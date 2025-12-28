import type { User } from "../types/user.js";

export type QueryResolver = {
  users: () => User[];
};

export const queryResolver: QueryResolver = {
  users: () => [
    { id: "1", name: "Alice", email: "alice@example.com" },
    { id: "2", name: "Bob", email: "bob@example.com" },
  ],
};

export type MutationResolver = {
  createUser: (args: { name: string; email: string }) => User;
  updateUser: (args: { id: string; name: string | null }) => User | null;
  deleteUser: (args: { id: string }) => boolean;
};

export const mutationResolver: MutationResolver = {
  createUser: (args) => ({
    id: crypto.randomUUID(),
    name: args.name,
    email: args.email,
  }),
  updateUser: (args) => ({
    id: args.id,
    name: args.name ?? "Unknown",
    email: "updated@example.com",
  }),
  deleteUser: () => true,
};
