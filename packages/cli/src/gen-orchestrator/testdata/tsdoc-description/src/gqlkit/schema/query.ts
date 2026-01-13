import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

interface User {
  id: string;
  name: string;
  email: string | null;
}

/**
 * Fetch a user by ID.
 */
export const user = defineQuery<{ id: string }, User | null>(
  (_root, args) => null,
);
