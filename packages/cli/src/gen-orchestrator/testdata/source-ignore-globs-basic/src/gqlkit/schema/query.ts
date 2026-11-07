import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export interface Widget {
  id: string;
  name: string;
}

export const widgets = defineQuery<NoArgs, Widget[]>(() => []);
