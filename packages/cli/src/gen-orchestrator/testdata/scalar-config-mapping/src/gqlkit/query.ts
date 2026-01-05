import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { Document } from "./document.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const documents = defineQuery<NoArgs, Document[]>(() => []);
