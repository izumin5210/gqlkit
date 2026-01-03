import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = unknown;
interface User {
  id: string;
  name: string;
}

const { defineQuery } = createGqlkitApis<Context>();

export const user = defineQuery<NoArgs, User | null>(() => null);
