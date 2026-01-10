import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = unknown;
interface User {
  id: string;
  name: string;
  email: string | null;
}

const { defineQuery } = createGqlkitApis<Context>();

export const users = defineQuery<NoArgs, User[]>(() => []);
