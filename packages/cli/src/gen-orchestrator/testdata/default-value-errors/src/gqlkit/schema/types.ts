import {
  createGqlkitApis,
  type GqlFieldDef,
  type Int,
  type NoArgs,
} from "@gqlkit-ts/runtime";

export type BadInput = {
  nonLiteralString: GqlFieldDef<string, { defaultValue: string }>;
  nonLiteralNumber: GqlFieldDef<Int, { defaultValue: number }>;
  nonLiteralBoolean: GqlFieldDef<boolean, { defaultValue: boolean }>;
};

export type Result = {
  value: string;
};

const { defineQuery } = createGqlkitApis();

export const bad = defineQuery<BadInput, Result>(() => ({ value: "" }));
