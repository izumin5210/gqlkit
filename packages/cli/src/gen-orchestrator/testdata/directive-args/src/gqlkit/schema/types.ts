import {
  createGqlkitApis,
  type Directive,
  type GqlFieldDef,
  type NoArgs,
} from "@gqlkit-ts/runtime";

export type Scope = "PUBLIC" | "PRIVATE";

export type CacheDirective<TArgs extends { maxAge: number; scope: Scope }> =
  Directive<"cache", TArgs, "FIELD_DEFINITION">;

export type LogDirective<TArgs extends { enabled: boolean; level: string }> =
  Directive<"log", TArgs, "FIELD_DEFINITION">;

export type Data = {
  cached: GqlFieldDef<
    string,
    { directives: [CacheDirective<{ maxAge: 3600; scope: "PUBLIC" }>] }
  >;
  logged: GqlFieldDef<
    string,
    { directives: [LogDirective<{ enabled: true; level: "DEBUG" }>] }
  >;
};

const { defineQuery } = createGqlkitApis();
export const data = defineQuery<NoArgs, Data>(() => ({
  cached: "",
  logged: "",
}));
