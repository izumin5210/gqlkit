import {
  createGqlkitApis,
  type Directive,
  type GqlFieldDef,
  type NoArgs,
} from "@gqlkit-ts/runtime";

type InternalAuthDirective<TArgs extends { role: string[] }> = Directive<
  "auth",
  TArgs,
  "FIELD_DEFINITION"
>;

export type User = {
  id: GqlFieldDef<
    string,
    { directives: [InternalAuthDirective<{ role: ["USER"] }>] }
  >;
};

const { defineQuery } = createGqlkitApis();
export const user = defineQuery<NoArgs, User | null>(() => null);
