import { defineQuery, type NoArgs } from "@gqlkit-ts/runtime";
import type { User } from "../types/user.js";

export const user = defineQuery<NoArgs, User | null>(() => ({
  id: "1",
  name: "Alice",
  email: null,
  posts: [
    { id: "1", title: "Hello World", content: "First post", author: null },
  ],
}));

export const users = defineQuery<NoArgs, User[]>(() => []);
