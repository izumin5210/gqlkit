import { defineField, type NoArgs } from "@gqlkit-ts/runtime";
import type { Post } from "../types/post.js";
import type { User } from "../types/user.js";

const posts: Post[] = [
  { id: "1", title: "Hello World", content: "My first post", authorId: "1" },
  { id: "2", title: "Second Post", content: "More content", authorId: "1" },
  { id: "3", title: "Bob's Post", content: "Bob writes here", authorId: "2" },
];

export const posts_ = defineField<User, NoArgs, Post[]>(
  (parent, _args, _ctx, _info) => posts.filter((p) => p.authorId === parent.id),
);

export const displayName = defineField<User, NoArgs, string>(
  (parent, _args, _ctx, _info) => `${parent.name} <${parent.email}>`,
);
