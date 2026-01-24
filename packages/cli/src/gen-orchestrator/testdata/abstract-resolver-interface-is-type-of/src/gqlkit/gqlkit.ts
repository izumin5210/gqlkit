import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { Context } from "./context.js";

export const { defineIsTypeOf, defineQuery } = createGqlkitApis<Context>();
