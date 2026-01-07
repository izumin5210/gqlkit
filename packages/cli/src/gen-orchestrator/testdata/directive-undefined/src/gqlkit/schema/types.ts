import { createGqlkitApis, type NoArgs, type Directive, type WithDirectives } from "@gqlkit-ts/runtime";

type InternalAuthDirective<TArgs extends { role: string[] }> = Directive<"auth", TArgs, "FIELD_DEFINITION">;

export type User = {
  id: WithDirectives<string, [InternalAuthDirective<{ role: ["USER"] }>]>;
};

const { defineQuery } = createGqlkitApis();
export const user = defineQuery<NoArgs, User | null>(() => null);
