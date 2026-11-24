import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { Context } from "./context.js";

export const { defineQuery, defineField, defineResolveType, defineIsTypeOf } =
  createGqlkitApis<Context>();
