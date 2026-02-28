import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { Context } from "./context.js";

export const { defineQuery, defineMutation, defineSubscription } =
  createGqlkitApis<Context>();
