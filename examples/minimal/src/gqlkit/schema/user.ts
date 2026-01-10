import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export interface User {
  id: string;
  name: string;
  age: number;
  isActive: boolean;
}

/**
 * Filter to find a specific user.
 * Exactly one field must be provided.
 */
export type UserFilterInput = { id: string } | { name: string };

const users: User[] = [
  { id: "1", name: "Alice", age: 30, isActive: true },
  { id: "2", name: "Bob", age: 25, isActive: false },
];

export const user = defineQuery<{ id: string }, User | null>(
  (_root, args) => users.find((u) => u.id === args.id) ?? null,
);

export const allUsers = defineQuery<NoArgs, User[]>(() => users);
