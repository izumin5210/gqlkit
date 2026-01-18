import type { GqlScalar } from "@gqlkit-ts/runtime";

/**
 * DateTime scalar using Date as base type.
 * All type aliases that resolve to Date should be mapped to this scalar.
 */
export type DateTime = GqlScalar<"DateTime", Date>;
