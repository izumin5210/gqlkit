import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { Context } from "./context.js";

export const { defineField, defineMutation, defineQuery } =
  createGqlkitApis<Context>();
