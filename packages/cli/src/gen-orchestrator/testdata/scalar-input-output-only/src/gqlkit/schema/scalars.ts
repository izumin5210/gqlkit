import type { GqlScalar } from "@gqlkit-ts/runtime";

/**
 * Input-only DateTime scalar.
 * This scalar is only valid for input types and resolver arguments.
 */
export type DateTimeInput = GqlScalar<"DateTimeInput", Date, "input">;

/**
 * Output-only DateTime scalar.
 * This scalar is only valid for object types and resolver return values.
 */
export type DateTimeOutput = GqlScalar<"DateTimeOutput", Date, "output">;
