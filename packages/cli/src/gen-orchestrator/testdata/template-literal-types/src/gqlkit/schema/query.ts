import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { ToolEvent } from "./types.js";

export const tool = defineQuery<NoArgs, ToolEvent>(() => ({
  type: "tool-search",
  version: "v1",
  label: "Search",
  tag: "ai-search",
}));
