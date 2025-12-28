import type { User } from "../types/user.js";
import { Status } from "../types/status.js";

export type QueryResolver = {
  user: () => User;
  users: () => User[];
};

export const queryResolver: QueryResolver = {
  user: () => ({
    id: "1",
    name: "Alice",
    status: Status.Active,
    role: "admin",
  }),
  users: () => [
    { id: "1", name: "Alice", status: Status.Active, role: "admin" },
    { id: "2", name: "Bob", status: Status.Pending, role: "user" },
    { id: "3", name: "Charlie", status: Status.Inactive, role: "guest" },
  ],
};
