import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = unknown;

export interface User {
  id: string;
  name: string;
}

const { defineQuery } = createGqlkitApis<Context>();

export const user = defineQuery<{ id: string }, User>(() => ({
  id: "1",
  name: "Test",
}));
