import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = unknown;

export interface User {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  title: string;
  authorId: string;
}

const { defineField } = createGqlkitApis<Context>();

export const posts = defineField<User, NoArgs, Post[]>((parent) => []);
