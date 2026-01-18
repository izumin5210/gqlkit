import type { NoArgs } from "@gqlkit-ts/runtime";
import type { ExternalDate } from "../../external/types.js";
import { defineQuery } from "../gqlkit.js";
import type { Event } from "./event.js";

/**
 * Query resolver returning events.
 */
export const events = defineQuery<NoArgs, Event[]>(() => []);

/**
 * Query resolver with ExternalDate in args - should map to DateTime.
 */
export const eventsSince = defineQuery<{ since: ExternalDate }, Event[]>(
  () => [],
);

/**
 * Query resolver returning ExternalDate directly - should map to DateTime.
 */
export const now = defineQuery<NoArgs, ExternalDate>(
  () => new Date() as ExternalDate,
);
