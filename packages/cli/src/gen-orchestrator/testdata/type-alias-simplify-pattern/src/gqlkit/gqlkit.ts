import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = {};

export const { defineQuery, defineMutation, defineField } =
  createGqlkitApis<Context>();
