import { createGqlkitApis, type NoArgs, type Directive, type GqlFieldDef } from "@gqlkit-ts/runtime";

export type Role = "USER" | "ADMIN";
export type AuthDirective<TArgs extends { role: Role[] }> = Directive<"auth", TArgs, "FIELD_DEFINITION">;

export type User = {
  id: string;
  email: GqlFieldDef<string, { directives: [AuthDirective<{ role: ["ADMIN"] }>] }>;
  nickname: GqlFieldDef<string | null, { directives: [AuthDirective<{ role: ["USER"] }>] }>;
};

const { defineQuery } = createGqlkitApis();

export const users = defineQuery<NoArgs, User[]>(() => []);

export const me = defineQuery<
  NoArgs,
  User,
  [AuthDirective<{ role: ["USER"] }>]
>(() => ({ id: "1", email: null, nickname: null }));
