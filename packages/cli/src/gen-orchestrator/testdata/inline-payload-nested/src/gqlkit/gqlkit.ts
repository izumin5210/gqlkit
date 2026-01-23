import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

export type Context = unknown;

export const { defineField, defineIsTypeOf, defineMutation, defineQuery } =
  createGqlkitApis<Context>();

export type { NoArgs };
