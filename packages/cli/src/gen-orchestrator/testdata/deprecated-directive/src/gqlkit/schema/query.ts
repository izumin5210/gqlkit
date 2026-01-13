import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

interface User {
  id: string;
  name: string;
  emailAddress: string | null;
  email: string | null;
}

export const user = defineQuery<NoArgs, User | null>(() => null);

/**
 * @deprecated Use users instead
 */
export const allUsers = defineQuery<NoArgs, User[]>(() => []);

export const users = defineQuery<NoArgs, User[]>(() => []);
