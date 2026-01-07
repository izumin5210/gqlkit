import type { Directive } from "@gqlkit-ts/runtime";

export type Role = "USER" | "ADMIN" | "MODERATOR";

/**
 * Authentication directive for protected fields.
 */
export type AuthDirective<TArgs extends { roles: Role[] }> = Directive<
  "auth",
  TArgs,
  "FIELD_DEFINITION"
>;

/**
 * Cache directive for caching query results.
 */
export type CacheDirective<TArgs extends { maxAge: number }> = Directive<
  "cache",
  TArgs,
  "OBJECT"
>;
