import type { GqlScalar } from "@gqlkit-ts/runtime";

// Error: Multiple input types for the same scalar
export type DateTimeInput1 = GqlScalar<"DateTime", Date, "input">;
export type DateTimeInput2 = GqlScalar<"DateTime", string, "input">;
