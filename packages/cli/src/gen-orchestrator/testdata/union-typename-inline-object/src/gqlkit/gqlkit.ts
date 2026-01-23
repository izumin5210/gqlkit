import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = {};

export const { defineQuery, defineField, defineResolveType, defineIsTypeOf } =
  createGqlkitApis<Context>();

export type { NoArgs } from "@gqlkit-ts/runtime";
