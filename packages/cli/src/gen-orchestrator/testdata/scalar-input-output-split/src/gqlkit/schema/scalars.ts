import { DefineScalar } from "@gqlkit-ts/runtime";

/**
 * Date input in ISO 8601 format
 */
export type DateTimeInput = DefineScalar<"DateTime", Date, "input">;

/**
 * Date output as Date object
 */
export type DateTimeOutput = DefineScalar<"DateTime", Date, "output">;

/**
 * Date output as string for JSON serialization
 */
export type DateTimeStringOutput = DefineScalar<"DateTime", string, "output">;
