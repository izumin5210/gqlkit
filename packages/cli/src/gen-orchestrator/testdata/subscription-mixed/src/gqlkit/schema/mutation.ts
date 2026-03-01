import { defineMutation } from "../gqlkit.js";

interface User {
  id: string;
  name: string;
}

export const createUser = defineMutation<{ name: string }, User>(
  (_root, args) => ({
    id: "1",
    name: args.name,
  }),
);
