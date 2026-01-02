import { defineQuery, type NoArgs } from "../gqlkit.js";
import type { User } from "../types/user.js";

const users: User[] = [
  { id: "1", name: "Alice", age: 30, isActive: true },
  { id: "2", name: "Bob", age: 25, isActive: false },
];

export const user = defineQuery<{ id: string }, User | null>((_root, args) =>
  users.find((u) => u.id === args.id) ?? null,
);

export const allUsers = defineQuery<NoArgs, User[]>(() => users);
