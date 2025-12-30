import { defineQuery } from "@gqlkit-ts/runtime";
import type { User } from "../types/user.js";

export const user = defineQuery<{ id: string }, User | null>((_root, args) => ({
  id: args.id,
  name: "User",
}));

export const users = defineQuery<
  { limit: number; offset: number | null },
  User[]
>((_root, args) => {
  const allUsers = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "3", name: "Charlie" },
  ];
  const offset = args.offset ?? 0;
  return allUsers.slice(offset, offset + args.limit);
});

export const search = defineQuery<
  { query: string; includeInactive: boolean | null },
  User[]
>((_root, args) => {
  const allUsers = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
  ];
  return allUsers.filter((u) =>
    u.name.toLowerCase().includes(args.query.toLowerCase()),
  );
});
