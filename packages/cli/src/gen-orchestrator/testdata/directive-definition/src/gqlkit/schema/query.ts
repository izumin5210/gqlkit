import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

export type User = {
  id: string;
  name: string;
};

const { defineQuery } = createGqlkitApis();
export const users = defineQuery<NoArgs, User[]>(() => []);
