import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Node } from "./node.js";
import type { User } from "./user.js";

export const users = defineQuery<NoArgs, User[]>(() => []);

export const node = defineQuery<{ id: string }, Node | null>(
  (_root, _args) => null,
);
