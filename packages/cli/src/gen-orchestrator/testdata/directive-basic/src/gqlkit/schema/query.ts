import { createGqlkitApis, type NoArgs, type Directive, type WithDirectives } from "@gqlkit-ts/runtime";

export type Role = "USER" | "ADMIN";
export type AuthDirective<TArgs extends { role: Role[] }> = Directive<"auth", TArgs, "FIELD_DEFINITION">;

export type User = {
  id: string;
  email: WithDirectives<string, [AuthDirective<{ role: ["ADMIN"] }>]>;
};

const { defineQuery } = createGqlkitApis();

export const users = defineQuery<NoArgs, User[]>(() => []);

export const me = defineQuery<
  NoArgs,
  User,
  WithDirectives<User, [AuthDirective<{ role: ["USER"] }>]>
>(() => ({ id: "1", email: null }));
