import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = unknown;
interface User {
  id: string;
  name: string;
  emailAddress: string | null;
  email: string | null;
}

const { defineQuery } = createGqlkitApis<Context>();

export const user = defineQuery<NoArgs, User | null>(() => null);

/**
 * @deprecated Use users instead
 */
export const allUsers = defineQuery<NoArgs, User[]>(() => []);

export const users = defineQuery<NoArgs, User[]>(() => []);
