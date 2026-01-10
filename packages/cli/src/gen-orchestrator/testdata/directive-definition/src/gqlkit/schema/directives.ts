import type { GqlDirective } from "@gqlkit-ts/runtime";

export type Role = "USER" | "ADMIN";
export type AuthDirective<TArgs extends { role: Role[] }> = GqlDirective<
  "auth",
  TArgs,
  "FIELD_DEFINITION"
>;
export type CacheDirective<TArgs extends { maxAge: number }> = GqlDirective<
  "cache",
  TArgs,
  ["FIELD_DEFINITION", "OBJECT"]
>;
