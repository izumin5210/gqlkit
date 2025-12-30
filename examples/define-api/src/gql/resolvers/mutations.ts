import { defineMutation } from "@gqlkit-ts/runtime";
import type { User } from "../types/user.js";

const users: User[] = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

export type CreateUserInput = {
  name: string;
  email: string;
};

export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  (_root, args, _ctx, _info) => {
    const newUser: User = {
      id: String(users.length + 1),
      name: args.input.name,
      email: args.input.email,
    };
    users.push(newUser);
    return newUser;
  },
);
