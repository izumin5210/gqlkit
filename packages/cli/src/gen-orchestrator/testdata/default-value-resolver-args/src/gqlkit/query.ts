import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = unknown;

interface User {
  id: string;
  name: string;
}

interface UsersArgs {
  /** @defaultValue 10 */
  limit: number;
  /** @defaultValue 0 */
  offset: number;
  /** @defaultValue "name" */
  sortBy: string;
  /** @defaultValue true */
  ascending: boolean;
}

const { defineQuery } = createGqlkitApis<Context>();

export const users = defineQuery<UsersArgs, User[]>((_root, _args) => []);
