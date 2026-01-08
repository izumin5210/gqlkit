import { createGqlkitApis, type NoArgs, type Directive, type GqlFieldDef } from "@gqlkit-ts/runtime";

type EmptyNameDirective = Directive<"", Record<string, never>, "FIELD_DEFINITION">;

export type User = {
  id: GqlFieldDef<string, { directives: [EmptyNameDirective] }>;
};

const { defineQuery } = createGqlkitApis();
export const user = defineQuery<NoArgs, User | null>(() => null);
