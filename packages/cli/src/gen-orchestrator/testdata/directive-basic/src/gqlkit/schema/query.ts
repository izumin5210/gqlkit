import {
  createGqlkitApis,
  type IDString,
  type NoArgs,
} from "@gqlkit-ts/runtime";

type Context = unknown;

interface User {
  id: IDString;
  name: string;
}

const { defineQuery } = createGqlkitApis<Context>();

export const users = defineQuery<NoArgs, User[]>(() => []);
