import {
  createGqlkitApis,
  type NoArgs,
  type WithDirectives,
} from "@gqlkit-ts/runtime";
import type { AuthDirective } from "./directives.js";
import type { User } from "./user.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const users = defineQuery<NoArgs, User[]>(() => []);

export const me = defineQuery<
  NoArgs,
  User,
  WithDirectives<User, [AuthDirective<{ roles: ["USER", "ADMIN"] }>]>
>(() => ({
  id: "1" as User["id"],
  name: "Test",
}));
