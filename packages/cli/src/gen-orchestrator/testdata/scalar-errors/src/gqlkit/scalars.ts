import { DefineScalar } from "@gqlkit-ts/runtime";

// Error: Multiple input types for the same scalar
export type DateTimeInput1 = DefineScalar<"DateTime", Date, "input">;
export type DateTimeInput2 = DefineScalar<"DateTime", string, "input">;
