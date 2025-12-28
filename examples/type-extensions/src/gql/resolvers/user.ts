import type { User } from "../types/user.js";
import type { Post } from "../types/post.js";

export type QueryResolver = {
  user: () => User;
};

export const queryResolver: QueryResolver = {
  user: () => ({ id: "1", firstName: "Alice", lastName: "Smith" }),
};

export type UserResolver = {
  fullName: (parent: User) => string;
  posts: (parent: User) => Post[];
};

export const userResolver: UserResolver = {
  fullName: (parent) => `${parent.firstName} ${parent.lastName}`,
  posts: (parent) => [
    { id: "1", title: "First Post", authorId: parent.id },
    { id: "2", title: "Second Post", authorId: parent.id },
  ],
};
