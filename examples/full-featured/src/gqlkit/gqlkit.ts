import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { Context } from "./context.js";

export type { Context };

export const { defineQuery, defineMutation, defineField, defineResolveType } =
  createGqlkitApis<Context>();
