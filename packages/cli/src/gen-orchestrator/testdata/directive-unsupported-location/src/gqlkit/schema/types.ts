import {
  createGqlkitApis,
  type Directive,
  type NoArgs,
} from "@gqlkit-ts/runtime";

export type ScalarDirective = Directive<
  "scalarOnly",
  Record<string, never>,
  "SCALAR"
>;

export type User = {
  id: string;
};

const { defineQuery } = createGqlkitApis();
export const user = defineQuery<NoArgs, User | null>(() => null);
