import type { GqlField, Int, NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export type BadInput = {
  nonLiteralString: GqlField<string, { defaultValue: string }>;
  nonLiteralNumber: GqlField<Int, { defaultValue: number }>;
  nonLiteralBoolean: GqlField<boolean, { defaultValue: boolean }>;
};

export type Result = {
  value: string;
};

export const bad = defineQuery<BadInput, Result>(() => ({ value: "" }));
