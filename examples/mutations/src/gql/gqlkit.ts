import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

export type Context = unknown;

export const { defineQuery, defineMutation, defineField } =
  createGqlkitApis<Context>();

export type { NoArgs };
