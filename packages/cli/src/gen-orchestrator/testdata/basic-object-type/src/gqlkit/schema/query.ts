import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

interface User {
  id: string;
  name: string;
  email: string | null;
}

export const users = defineQuery<NoArgs, User[]>(() => []);

export const user = defineQuery<{ id: string }, User | null>((_root, args) => ({
  id: args.id,
  name: "Test",
  email: null,
}));
