import {
  createGqlkitApis,
  type GqlDirective,
  type GqlField,
  type NoArgs,
} from "@gqlkit-ts/runtime";

export type ObjectOnlyDirective = GqlDirective<
  "objectOnly",
  Record<string, never>,
  "OBJECT"
>;

export type User = {
  id: GqlField<string, { directives: [ObjectOnlyDirective] }>;
};

const { defineQuery } = createGqlkitApis();
export const user = defineQuery<NoArgs, User | null>(() => null);
