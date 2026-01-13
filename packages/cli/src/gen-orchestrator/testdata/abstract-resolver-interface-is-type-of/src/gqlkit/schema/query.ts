import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

type Context = unknown;
const { defineQuery } = createGqlkitApis<Context>();

export const node = defineQuery<{ id: string }, Node | null>(() => null);
