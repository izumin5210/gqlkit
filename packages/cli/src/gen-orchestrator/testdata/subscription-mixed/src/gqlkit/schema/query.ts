import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

interface User {
  id: string;
  name: string;
}

export const users = defineQuery<NoArgs, User[]>(() => []);
