import type { GqlScalar } from "@gqlkit-ts/runtime";

/**
 * Date input in ISO 8601 format
 */
export type DateTimeInput = GqlScalar<"DateTime", Date, "input">;

/**
 * Date output as Date object
 */
export type DateTimeOutput = GqlScalar<"DateTime", Date, "output">;

/**
 * Date output as string for JSON serialization
 */
export type DateTimeStringOutput = GqlScalar<"DateTime", string, "output">;
