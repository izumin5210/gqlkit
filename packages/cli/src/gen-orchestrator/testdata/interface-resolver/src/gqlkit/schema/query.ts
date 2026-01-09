import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";
import type { User } from "./user.js";

const { defineQuery } = createGqlkitApis();

export const users = defineQuery<NoArgs, User[]>(() => []);

export const node = defineQuery<{ id: string }, Node | null>(
  (_, { id }) => null,
);
