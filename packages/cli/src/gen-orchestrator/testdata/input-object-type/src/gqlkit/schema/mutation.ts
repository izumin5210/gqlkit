import { defineMutation } from "../gqlkit.js";

interface User {
  id: string;
  name: string;
  email: string | null;
}
interface CreateUserInput {
  name: string;
  email?: string;
}

export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  (_root, args) => ({
    id: "1",
    name: args.input.name,
    email: args.input.email ?? null,
  }),
);
