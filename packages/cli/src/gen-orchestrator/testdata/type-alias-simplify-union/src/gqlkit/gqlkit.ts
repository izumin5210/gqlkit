import { createGqlkitApis } from "@gqlkit-ts/runtime";

export const { defineQuery, defineMutation, defineField, defineResolveType } =
  createGqlkitApis<Record<string, never>>();
