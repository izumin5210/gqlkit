import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Event } from "./event.js";

/**
 * Query resolver returning events.
 */
export const events = defineQuery<NoArgs, Event[]>(() => []);
