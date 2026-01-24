import {
  createGqlkitApis,
  type GqlInterface,
  type GqlObject,
} from "@gqlkit-ts/runtime";
import type { Context } from "./context.js";

export const { defineQuery } = createGqlkitApis<Context>();

export type { GqlInterface, GqlObject };
