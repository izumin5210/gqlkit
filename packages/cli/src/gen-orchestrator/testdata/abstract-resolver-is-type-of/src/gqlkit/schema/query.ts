import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { Animal } from "./types.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const animals = defineQuery<NoArgs, Animal[]>(() => []);
