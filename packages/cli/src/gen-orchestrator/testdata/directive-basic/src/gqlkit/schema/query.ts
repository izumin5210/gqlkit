import {
  createGqlkitApis,
  type GqlDirective,
  type GqlField,
  type NoArgs,
} from "@gqlkit-ts/runtime";

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

const { defineQuery } = createGqlkitApis();

export const users = defineQuery<NoArgs, User[]>(() => []);

export const me = defineQuery<
  NoArgs,
  User,
  [AuthDirective<{ role: ["USER"] }>]
>(() => ({ id: "1", email: null, nickname: null }));
