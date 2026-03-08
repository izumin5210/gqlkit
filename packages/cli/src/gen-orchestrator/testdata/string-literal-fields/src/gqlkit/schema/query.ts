import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { StatusEvent } from "./types.js";

export const event = defineQuery<NoArgs, StatusEvent>(() => ({
  code: "success",
  type: "event",
  numericCode: 200,
  label: "test",
}));
