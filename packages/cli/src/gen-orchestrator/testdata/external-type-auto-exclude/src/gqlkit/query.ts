import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { User } from "./user.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const user = defineQuery<NoArgs, User>(() => ({
  id: "1",
  name: "Test",
  email: "test@example.com",
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: 0,
  _version: "v1",
}));
