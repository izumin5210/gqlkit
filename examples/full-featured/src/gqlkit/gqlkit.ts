import { createGqlkitApis } from "@gqlkit-ts/runtime";

export type Context = {
  currentUserId: string | null;
};

export const { defineQuery, defineMutation, defineField, defineResolveType } =
  createGqlkitApis<Context>();
