import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { ExistingType } from "./types.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const existing = defineQuery<NoArgs, ExistingType[]>(() => []);
