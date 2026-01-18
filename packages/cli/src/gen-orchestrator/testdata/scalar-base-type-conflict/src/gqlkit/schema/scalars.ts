import type { GqlScalar } from "@gqlkit-ts/runtime";

/**
 * DateTime scalar using Date as base type.
 */
export type DateTime = GqlScalar<"DateTime", Date>;

/**
 * ISODate scalar also using Date as base type.
 * This creates a conflict with DateTime for the same base type.
 */
export type ISODate = GqlScalar<"ISODate", Date>;
