import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = unknown;
interface User {
  id: string;
  name: string;
  email: string | null;
}

const { defineQuery } = createGqlkitApis<Context>();

/**
 * Fetch a user by ID.
 */
export const user = defineQuery<{ id: string }, User | null>(
  (_root, args) => null,
);
