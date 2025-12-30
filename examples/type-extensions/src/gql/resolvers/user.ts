import { defineField, defineQuery, type NoArgs } from "@gqlkit-ts/runtime";
import type { Post } from "../types/post.js";
import type { User } from "../types/user.js";

export const user = defineQuery<NoArgs, User>(() => ({
  id: "1",
  firstName: "Alice",
  lastName: "Smith",
}));

export const fullName = defineField<User, NoArgs, string>(
  (parent) => `${parent.firstName} ${parent.lastName}`,
);

export const userPosts = defineField<User, NoArgs, Post[]>((parent) => [
  { id: "1", title: "First Post", authorId: parent.id },
  { id: "2", title: "Second Post", authorId: parent.id },
]);
