import type { GqlDirective, GqlField, NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export type Scope = "PUBLIC" | "PRIVATE";

export type CacheDirective<TArgs extends { maxAge: number; scope: Scope }> =
  GqlDirective<"cache", TArgs, "FIELD_DEFINITION">;

export type LogDirective<TArgs extends { enabled: boolean; level: string }> =
  GqlDirective<"log", TArgs, "FIELD_DEFINITION">;

export type Data = {
  cached: GqlField<
    string,
    { directives: [CacheDirective<{ maxAge: 3600; scope: "PUBLIC" }>] }
  >;
  logged: GqlField<
    string,
    { directives: [LogDirective<{ enabled: true; level: "DEBUG" }>] }
  >;
};

export const data = defineQuery<NoArgs, Data>(() => ({
  cached: "",
  logged: "",
}));
