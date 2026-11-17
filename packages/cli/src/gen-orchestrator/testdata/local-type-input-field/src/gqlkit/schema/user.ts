import { defineMutation } from "../gqlkit.js";

// Not exported: reached only through UpdateUserInput's field.
interface Address {
  city: string;
}

export interface UpdateUserInput {
  address: Address;
}

export interface User {
  id: string;
}

export const updateUser = defineMutation<{ input: UpdateUserInput }, User>(
  () => ({ id: "1" }),
);
