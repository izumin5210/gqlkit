import type { DefineScalar } from "@gqlkit-ts/runtime";

/**
 * ISO 8601 format date-time string
 */
export type DateTime = DefineScalar<"DateTime", Date>;
