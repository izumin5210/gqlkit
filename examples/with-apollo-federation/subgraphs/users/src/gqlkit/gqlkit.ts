import { createGqlkitApis } from "@gqlkit-ts/runtime";
import { createFederationApis } from "@gqlkit-ts/runtime/federation";
import type { Context } from "./context.js";

export const { defineQuery, defineField } = createGqlkitApis<Context>();
export const { defineResolveReference } = createFederationApis<Context>();
