import type { GqlDirective, GqlField, NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export type Role = "USER" | "ADMIN";
export type AuthDirective<TArgs extends { role: Role[] }> = GqlDirective<
  "auth",
  TArgs,
  "FIELD_DEFINITION"
>;

export type User = {
  id: string;
  email: GqlField<string, { directives: [AuthDirective<{ role: ["ADMIN"] }>] }>;
  nickname: GqlField<
    string | null,
    { directives: [AuthDirective<{ role: ["USER"] }>] }
  >;
};

export const users = defineQuery<NoArgs, User[]>(() => []);

export const me = defineQuery<
  NoArgs,
  User,
  [AuthDirective<{ role: ["USER"] }>]
>(() => ({ id: "1", email: null, nickname: null }));
