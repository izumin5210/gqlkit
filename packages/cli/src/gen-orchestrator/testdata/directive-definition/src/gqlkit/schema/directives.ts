import { type Directive } from "@gqlkit-ts/runtime";

export type Role = "USER" | "ADMIN";
export type AuthDirective<TArgs extends { role: Role[] }> = Directive<"auth", TArgs, "FIELD_DEFINITION">;
export type CacheDirective<TArgs extends { maxAge: number }> = Directive<"cache", TArgs, ["FIELD_DEFINITION", "OBJECT"]>;
