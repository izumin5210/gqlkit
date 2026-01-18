import type { GqlScalar } from "@gqlkit-ts/runtime";

/**
 * DateTime scalar using Date as base type.
 */
export type DateTime = GqlScalar<"DateTime", Date>;
