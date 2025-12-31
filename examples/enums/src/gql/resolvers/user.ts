import { defineQuery, type NoArgs } from "../gqlkit.js";
import { Status } from "../types/status.js";
import type { User } from "../types/user.js";

export const user = defineQuery<NoArgs, User>(() => ({
  id: "1",
  name: "Alice",
  status: Status.Active,
  role: "admin",
}));

export const users = defineQuery<NoArgs, User[]>(() => [
  { id: "1", name: "Alice", status: Status.Active, role: "admin" },
  { id: "2", name: "Bob", status: Status.Pending, role: "user" },
  { id: "3", name: "Charlie", status: Status.Inactive, role: "guest" },
]);
