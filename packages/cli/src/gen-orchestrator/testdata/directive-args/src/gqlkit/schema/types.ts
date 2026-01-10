import {
  createGqlkitApis,
  type GqlDirective,
  type GqlField,
  type NoArgs,
} from "@gqlkit-ts/runtime";

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

const { defineQuery } = createGqlkitApis();
export const data = defineQuery<NoArgs, Data>(() => ({
  cached: "",
  logged: "",
}));
