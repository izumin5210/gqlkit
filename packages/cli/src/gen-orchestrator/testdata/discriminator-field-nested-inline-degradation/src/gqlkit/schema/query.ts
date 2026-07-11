import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Event } from "./types.js";

export const eventQuery = defineQuery<NoArgs, Event>("event", (_args, _ctx) => {
  return { type: "chart", data: { title: "hello", value: 1 } };
});
