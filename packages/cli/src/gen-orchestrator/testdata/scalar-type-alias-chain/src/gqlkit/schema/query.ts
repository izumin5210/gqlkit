import type { NoArgs } from "@gqlkit-ts/runtime";
import type { AppDate, MyDate, Timestamp } from "../../common/types.js";
import { defineQuery } from "../gqlkit.js";
import type { Event } from "./event.js";

/**
 * Query resolver returning events.
 */
export const events = defineQuery<NoArgs, Event[]>(() => []);

/**
 * Query resolver with Timestamp in args.
 * Should map to DateTime.
 */
export const eventsSince = defineQuery<{ since: Timestamp }, Event[]>(() => []);

/**
 * Query resolver returning MyDate.
 * Should map to DateTime.
 */
export const currentDate = defineQuery<NoArgs, MyDate>(
  () => new Date() as MyDate,
);

/**
 * Query resolver with AppDate in args.
 * Should map to DateTime.
 */
export const eventsUntil = defineQuery<{ until: AppDate }, Event[]>(() => []);
