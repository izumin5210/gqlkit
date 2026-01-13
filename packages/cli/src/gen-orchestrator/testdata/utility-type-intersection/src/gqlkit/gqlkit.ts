import { createGqlkitApis } from "@gqlkit-ts/runtime";

export type Context = unknown;

export const { defineMutation, defineQuery } = createGqlkitApis<Context>();
