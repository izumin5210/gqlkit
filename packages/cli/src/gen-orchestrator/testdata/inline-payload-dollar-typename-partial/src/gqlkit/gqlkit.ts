import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

export type Context = unknown;

export const {
  defineField,
  defineMutation,
  defineQuery,
  defineIsTypeOf,
  defineResolveType,
} = createGqlkitApis<Context>();

export type { NoArgs };
