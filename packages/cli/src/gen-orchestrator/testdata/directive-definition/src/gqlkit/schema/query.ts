import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export type User = {
  id: string;
  name: string;
};

export const users = defineQuery<NoArgs, User[]>(() => []);
