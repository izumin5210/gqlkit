import type { GqlDirective, GqlField, NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export type Role = "USER" | "ADMIN";

export type AuthDirective<TArgs extends { role: Role[] }> = GqlDirective<
  "auth",
  TArgs,
  "FIELD_DEFINITION"
>;
export type CacheDirective<TArgs extends { maxAge: number }> = GqlDirective<
  "cache",
  TArgs,
  "FIELD_DEFINITION"
>;
export type LogDirective = GqlDirective<
  "log",
  Record<string, never>,
  "FIELD_DEFINITION"
>;

export type User = {
  id: string;
  secret: GqlField<
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

export const user = defineQuery<NoArgs, User | null>(() => null);
