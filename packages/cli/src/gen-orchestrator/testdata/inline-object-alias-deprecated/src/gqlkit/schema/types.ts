import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

// Not exported: reached only through `getAddress`'s payload field, so it is
// auto-generated (never a declared schema type) — the "inline object type
// alias" shape whose type-level `@deprecated` tag bug #9 dropped. (A
// declared type's own field referencing a plain object alias like this
// instead goes through type-extractor's separate "discovered type"
// mechanism, a different code path not exercised here.)
/**
 * Physical address information.
 * @deprecated Use the geocoded Location type instead.
 */
type LegacyAddress = {
  street: string;
  city: string;
};

export const getAddress = defineQuery<NoArgs, { address: LegacyAddress }>(
  () => ({
    address: { street: "123 Main St", city: "Springfield" },
  }),
);
