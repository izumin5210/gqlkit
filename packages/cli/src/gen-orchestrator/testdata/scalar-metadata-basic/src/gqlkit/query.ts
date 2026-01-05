import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { Event } from "./event.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const events = defineQuery<NoArgs, Event[]>(() => []);
