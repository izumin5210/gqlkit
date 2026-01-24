import { createGqlkitApis } from "@gqlkit-ts/runtime";

export type Context = unknown;

export const { defineQuery, defineMutation } = createGqlkitApis<Context>();
