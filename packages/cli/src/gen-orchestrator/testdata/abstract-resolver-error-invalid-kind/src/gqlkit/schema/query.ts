import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { SearchResult, User } from "./types.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const users = defineQuery<Record<string, never>, User[]>(() => []);

export const search = defineQuery<{ query: string }, SearchResult[]>(() => []);
