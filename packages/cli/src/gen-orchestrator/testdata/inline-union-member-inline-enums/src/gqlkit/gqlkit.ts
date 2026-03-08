import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { Context } from "./context.js";

export const { defineQuery, defineIsTypeOf } = createGqlkitApis<Context>();
export type { NoArgs } from "@gqlkit-ts/runtime";
