import {
  createGqlkitApis,
  type GqlDirective,
  type GqlField,
  type NoArgs,
} from "@gqlkit-ts/runtime";

type EmptyNameDirective = GqlDirective<
  "",
  Record<string, never>,
  "FIELD_DEFINITION"
>;

export type User = {
  id: GqlField<string, { directives: [EmptyNameDirective] }>;
};

const { defineQuery } = createGqlkitApis();
export const user = defineQuery<NoArgs, User | null>(() => null);
