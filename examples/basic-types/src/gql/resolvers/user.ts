import type { User } from "../types/user.js";

export type QueryResolver = {
  user: () => User;
  users: () => User[];
};

export const queryResolver: QueryResolver = {
  user: () => ({ id: "1", name: "Alice", age: 30, isActive: true }),
  users: () => [
    { id: "1", name: "Alice", age: 30, isActive: true },
    { id: "2", name: "Bob", age: 25, isActive: false },
  ],
};
