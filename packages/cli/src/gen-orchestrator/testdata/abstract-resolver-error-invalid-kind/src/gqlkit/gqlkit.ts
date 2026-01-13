import { createGqlkitApis } from "@gqlkit-ts/runtime";

export type Context = unknown;

export const { defineIsTypeOf, defineQuery, defineResolveType } =
  createGqlkitApis<Context>();
