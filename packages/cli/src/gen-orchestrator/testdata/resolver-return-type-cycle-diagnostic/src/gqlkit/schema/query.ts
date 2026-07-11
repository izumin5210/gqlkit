import type { NoArgs } from "@gqlkit-ts/runtime";
import type { RecursiveMeta } from "../../external/types.js";
import { defineQuery } from "../gqlkit.js";

/**
 * The inline return type's `meta` field should surface a resolver-side
 * CYCLE_DETECTED diagnostic, mirroring the declared-type case in
 * discriminator-field-inline-union-cycle-diagnostic. Recursive external
 * object aliases from .d.ts trigger CYCLE_DETECTED and the warning must
 * not be dropped when the cycle occurs while resolving a resolver's
 * return type instead of a declared object type.
 */
export const status = defineQuery<
  NoArgs,
  {
    id: string;
    meta: RecursiveMeta;
  }
>(() => ({
  id: "1",
  meta: { label: "start", next: { label: "next", next: null as never } },
}));
