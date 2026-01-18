import type { GqlScalar } from "@gqlkit-ts/runtime";

/**
 * ISO 8601 format date-time string
 */
export type DateTime = GqlScalar<"DateTime", Date>;
