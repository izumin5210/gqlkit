import { createGqlkitApis } from "@gqlkit-ts/runtime";

export type Context = {
  userId: string;
};

export const { defineQuery, defineMutation, defineField } =
  createGqlkitApis<Context>();
