import { defineQuery } from "../gqlkit.js";
import type { AdminResult, UserResult } from "./types.js";

export const users = defineQuery<{ query: string }, UserResult>(
  (_root, _args) => ({ __typename: "Person", id: "1", name: "Test" }),
);

export const admins = defineQuery<{ query: string }, AdminResult>(
  (_root, _args) => ({ __typename: "Person", id: "1", role: "admin" }),
);
