import { createGqlkitApis, type NoArgs, type Directive, type WithDirectives } from "@gqlkit-ts/runtime";

export type Scope = "PUBLIC" | "PRIVATE";

export type CacheDirective<TArgs extends { maxAge: number; scope: Scope }> =
  Directive<"cache", TArgs, "FIELD_DEFINITION">;

export type LogDirective<TArgs extends { enabled: boolean; level: string }> =
  Directive<"log", TArgs, "FIELD_DEFINITION">;

export type Data = {
  cached: WithDirectives<string, [CacheDirective<{ maxAge: 3600; scope: "PUBLIC" }>]>;
  logged: WithDirectives<string, [LogDirective<{ enabled: true; level: "DEBUG" }>]>;
};

const { defineQuery } = createGqlkitApis();
export const data = defineQuery<NoArgs, Data>(() => ({ cached: "", logged: "" }));
