import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = unknown;
interface User {
  id: string;
  name: string;
  email: string | null;
}
interface CreateUserInput {
  name: string;
  email?: string;
}

const { defineMutation } = createGqlkitApis<Context>();

export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  (_root, args) => ({
    id: "1",
    name: args.input.name,
    email: args.input.email ?? null,
  }),
);
