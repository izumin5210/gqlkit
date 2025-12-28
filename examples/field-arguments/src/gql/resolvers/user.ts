import type { User } from "../types/user.js";

export type QueryResolver = {
  user: (args: { id: string }) => User | null;
  users: (args: { limit: number; offset: number | null }) => User[];
  search: (args: { query: string; includeInactive: boolean | null }) => User[];
};

export const queryResolver: QueryResolver = {
  user: (args) => ({ id: args.id, name: "User" }),
  users: (args) => {
    const users = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
      { id: "3", name: "Charlie" },
    ];
    const offset = args.offset ?? 0;
    return users.slice(offset, offset + args.limit);
  },
  search: (args) => {
    const users = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    return users.filter((u) =>
      u.name.toLowerCase().includes(args.query.toLowerCase())
    );
  },
};
