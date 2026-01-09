import {
  createGqlkitApis,
  type Directive,
  type GqlFieldDef,
  type NoArgs,
} from "@gqlkit-ts/runtime";

export type Role = "USER" | "ADMIN";

export type AuthDirective<TArgs extends { role: Role[] }> = Directive<
  "auth",
  TArgs,
  "FIELD_DEFINITION"
>;
export type CacheDirective<TArgs extends { maxAge: number }> = Directive<
  "cache",
  TArgs,
  "FIELD_DEFINITION"
>;
export type LogDirective = Directive<
  "log",
  Record<string, never>,
  "FIELD_DEFINITION"
>;

export type User = {
  id: string;
  secret: GqlFieldDef<
    string,
    {
      directives: [
        AuthDirective<{ role: ["ADMIN"] }>,
        CacheDirective<{ maxAge: 60 }>,
        LogDirective,
      ];
    }
  >;
};

const { defineQuery } = createGqlkitApis();
export const user = defineQuery<NoArgs, User | null>(() => null);
