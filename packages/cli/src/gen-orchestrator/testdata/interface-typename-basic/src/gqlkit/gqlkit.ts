import {
  createGqlkitApis,
  type GqlInterface,
  type GqlObject,
} from "@gqlkit-ts/runtime";

export type Context = unknown;

export const { defineQuery } = createGqlkitApis<Context>();

export type { GqlInterface, GqlObject };
