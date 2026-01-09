import {
  createGqlkitApis,
  type Directive,
  type GqlFieldDef,
  type NoArgs,
} from "@gqlkit-ts/runtime";

export type ObjectOnlyDirective = Directive<
  "objectOnly",
  Record<string, never>,
  "OBJECT"
>;

export type User = {
  id: GqlFieldDef<string, { directives: [ObjectOnlyDirective] }>;
};

const { defineQuery } = createGqlkitApis();
export const user = defineQuery<NoArgs, User | null>(() => null);
