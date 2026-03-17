import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Post, User } from "./types.js";

export const users = defineQuery<NoArgs, User[]>(() => []);

export const user = defineQuery<{ id: string }, User | null>((_root, args) => ({
  id: args.id,
  name: "Test User",
  email: null,
}));

export const posts = defineQuery<NoArgs, Post[]>(() => []);
