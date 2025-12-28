import type { User } from "../types/user.js";

export type QueryResolver = {
  user: () => User | null;
  users: () => User[];
};

export const queryResolver: QueryResolver = {
  user: () => ({
    id: "1",
    name: "Alice",
    email: null,
    posts: [
      { id: "1", title: "Hello World", content: "First post", author: null },
    ],
  }),
  users: () => [],
};
