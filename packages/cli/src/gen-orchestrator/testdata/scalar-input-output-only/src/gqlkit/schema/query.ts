import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Event } from "./event.js";

/**
 * Query resolver returning events.
 */
export const events = defineQuery<NoArgs, Event[]>(() => []);

/**
 * Query resolver with Date in args - should map to DateTimeInput (input context).
 */
export const eventsSince = defineQuery<{ since: Date }, Event[]>(() => []);

/**
 * Query resolver returning Date directly - should map to DateTimeOutput (output context).
 */
export const now = defineQuery<NoArgs, Date>(() => new Date());
