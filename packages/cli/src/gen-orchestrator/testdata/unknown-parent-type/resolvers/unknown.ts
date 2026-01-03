import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = unknown;

interface UnknownType {
  id: string;
}

const { defineField } = createGqlkitApis<Context>();

export const posts = defineField<UnknownType, NoArgs, string[]>(() => []);
