import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineField } from "../gqlkit.js";

export interface User {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  title: string;
  authorId: string;
}

export const posts = defineField<User, NoArgs, Post[]>((_parent) => []);
