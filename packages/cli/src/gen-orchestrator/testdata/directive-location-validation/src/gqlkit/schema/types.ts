import { createGqlkitApis, type NoArgs, type Directive, type WithDirectives } from "@gqlkit-ts/runtime";

export type ObjectOnlyDirective = Directive<"objectOnly", Record<string, never>, "OBJECT">;

export type User = {
  id: WithDirectives<string, [ObjectOnlyDirective]>;
};

const { defineQuery } = createGqlkitApis();
export const user = defineQuery<NoArgs, User | null>(() => null);
