import type { ScalarBrand } from "@gqlkit-ts/runtime";

/**
 * ISO 8601 date-time string (custom scalar)
 */
export type DateTime = ScalarBrand<"DateTime"> & string;
