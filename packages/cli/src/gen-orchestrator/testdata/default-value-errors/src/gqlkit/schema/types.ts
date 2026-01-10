import {
  createGqlkitApis,
  type GqlField,
  type Int,
  type NoArgs,
} from "@gqlkit-ts/runtime";

export type BadInput = {
  nonLiteralString: GqlField<string, { defaultValue: string }>;
  nonLiteralNumber: GqlField<Int, { defaultValue: number }>;
  nonLiteralBoolean: GqlField<boolean, { defaultValue: boolean }>;
};

export type Result = {
  value: string;
};

const { defineQuery } = createGqlkitApis();

export const bad = defineQuery<BadInput, Result>(() => ({ value: "" }));
