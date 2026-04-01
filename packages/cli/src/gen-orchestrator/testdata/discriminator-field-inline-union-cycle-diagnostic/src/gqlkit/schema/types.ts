import type { RecursiveMeta } from "../../external/types.js";

/**
 * Inline union member properties should surface resolver diagnostics.
 * Recursive external object aliases from .d.ts trigger CYCLE_DETECTED
 * and the warning must not be dropped.
 */
export type StreamEvent =
  | {
      type: "start";
      meta: RecursiveMeta;
    }
  | {
      type: "end";
      meta: RecursiveMeta;
    };
