import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = unknown;
interface BadType {
  id: string;
  data: string;
}

const { defineQuery } = createGqlkitApis<Context>();

export const bad = defineQuery<NoArgs, BadType | null>(() => null);
