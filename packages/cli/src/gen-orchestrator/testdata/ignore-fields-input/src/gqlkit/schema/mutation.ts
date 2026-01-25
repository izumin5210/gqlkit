import { defineMutation } from "../gqlkit.js";
import type { CreateUserInput, User } from "./types.js";

export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  () => ({ id: "1" as any, name: "Test", email: "test@example.com" }),
);
