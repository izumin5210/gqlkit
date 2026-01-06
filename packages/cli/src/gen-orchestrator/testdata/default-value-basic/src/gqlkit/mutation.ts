import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = unknown;

interface User {
  id: string;
  name: string;
}

interface CreateUserInput {
  name: string;
  age: number;
  rating: number;
  active: boolean;
  bio: string | null;
}

const { defineMutation } = createGqlkitApis<Context>();

export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  (_root, args) => ({
    id: "1",
    name: args.input.name,
  }),
);
