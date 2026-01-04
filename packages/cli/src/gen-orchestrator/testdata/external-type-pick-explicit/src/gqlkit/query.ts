import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { User } from "./user.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const user = defineQuery<NoArgs, User>(() => ({
  id: "1",
  name: "Test",
  email: "test@example.com",
}));
