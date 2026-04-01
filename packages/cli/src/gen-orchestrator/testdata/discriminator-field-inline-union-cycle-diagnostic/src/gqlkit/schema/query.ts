import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { StreamEvent } from "./types.js";

export const streamEvents = defineQuery<NoArgs, StreamEvent[]>(
  "streamEvents",
  () => [],
);
