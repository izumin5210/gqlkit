import { createGqlkitApis } from "@gqlkit-ts/runtime";

export const { defineQuery, defineMutation, defineField } =
  createGqlkitApis<{}>();
