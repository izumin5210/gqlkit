import { defineQuery, type NoArgs } from "../gqlkit.js";
import type { User } from "../types/user.js";

export const user = defineQuery<NoArgs, User>(() => ({
  id: "1",
  name: "Alice",
  age: 30,
  isActive: true,
}));

export const users = defineQuery<NoArgs, User[]>(() => [
  { id: "1", name: "Alice", age: 30, isActive: true },
  { id: "2", name: "Bob", age: 25, isActive: false },
]);
