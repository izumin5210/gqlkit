import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

interface BadType {
  id: string;
  data: string;
}

export const bad = defineQuery<NoArgs, BadType | null>(() => null);
