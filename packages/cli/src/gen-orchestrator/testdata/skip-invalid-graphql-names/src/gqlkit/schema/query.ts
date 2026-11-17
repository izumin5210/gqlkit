import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

interface User {
  id: string;
  name: string;
  email: string | null;
}

export const users = defineQuery<NoArgs, User[]>(() => []);

export const searchUsers = defineQuery<
  {
    name: string;
    // Invalid argument names (should be skipped)
    "0invalid": string;
    __reserved: string;
    "hyphen-arg": string;
    // Typename discrimination fields (should be excluded without a diagnostic)
    $typeName: "User" | "Admin";
    __typename: "User";
  },
  User[]
>(() => []);
