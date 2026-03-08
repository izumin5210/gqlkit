import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { PartBase } from "./types.js";

export const part = defineQuery<NoArgs, PartBase>(() => ({
  type: "text",
  text: "hello",
  label: "greeting",
}));
