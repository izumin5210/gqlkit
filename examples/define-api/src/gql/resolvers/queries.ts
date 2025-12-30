import { defineQuery, type NoArgs } from "@gqlkit-ts/runtime";
import type { User } from "../types/user.js";

const users: User[] = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

export const me = defineQuery<NoArgs, User>(
  (_root, _args, _ctx, _info) => users[0]!,
);

export const allUsers = defineQuery<NoArgs, User[]>(
  (_root, _args, _ctx, _info) => users,
);

export const user = defineQuery<{ id: string }, User | null>(
  (_root, args, _ctx, _info) => users.find((u) => u.id === args.id) ?? null,
);
