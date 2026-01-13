import { createGqlkitApis } from "@gqlkit-ts/runtime";

export type Context = unknown;

export const { defineField, defineQuery, defineResolveType } =
  createGqlkitApis<Context>();
