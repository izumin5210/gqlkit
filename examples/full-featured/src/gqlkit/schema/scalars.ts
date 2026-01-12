import type { GqlScalar } from "@gqlkit-ts/runtime";

/**
 * ISO 8601 date-time string (custom scalar)
 */
export type DateTime = GqlScalar<"DateTime", Date>;
