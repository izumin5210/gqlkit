import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

export type Context = {
  currentUserId: string | null;
};

export const { defineQuery, defineMutation, defineField } =
  createGqlkitApis<Context>();

export type { NoArgs };
