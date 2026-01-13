import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineField } from "../gqlkit.js";

interface UnknownType {
  id: string;
}

export const posts = defineField<UnknownType, NoArgs, string[]>(() => []);
