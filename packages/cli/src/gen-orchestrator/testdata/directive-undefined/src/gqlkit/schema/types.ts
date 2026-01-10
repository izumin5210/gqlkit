import {
  createGqlkitApis,
  type GqlDirective,
  type GqlField,
  type NoArgs,
} from "@gqlkit-ts/runtime";

type InternalAuthDirective<TArgs extends { role: string[] }> = GqlDirective<
  "auth",
  TArgs,
  "FIELD_DEFINITION"
>;

export type User = {
  id: GqlField<
    string,
    { directives: [InternalAuthDirective<{ role: ["USER"] }>] }
  >;
};

const { defineQuery } = createGqlkitApis();
export const user = defineQuery<NoArgs, User | null>(() => null);
