import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { User } from "./user.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const users = defineQuery<NoArgs, User[]>(() => []);
