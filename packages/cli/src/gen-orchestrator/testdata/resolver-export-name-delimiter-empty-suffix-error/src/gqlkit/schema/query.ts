import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export interface User {
  id: string;
  name: string;
}

export const Query$ = defineQuery<NoArgs, User | null>(() => null);
