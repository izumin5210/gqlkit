import { defineIsTypeOf } from "../gqlkit.js";

// These interfaces are NOT exported - they are "external" types
// discovered transitively through union field analysis.
interface ExternalAlpha {
  label: string;
}

interface ExternalBeta {
  score: number;
}

/**
 * Direct (non-array) union with discovered named members.
 * ExternalAlpha and ExternalBeta should be registered with original names.
 */
export type SearchResult = {
  /** Non-nullable direct union of discovered types */
  item: ExternalAlpha | ExternalBeta;
};

/**
 * Nullable union with discovered named members.
 * Tests that nullability is preserved for discovered types.
 */
export type NullableResult = {
  /** Nullable direct union of discovered types */
  result: ExternalAlpha | ExternalBeta | null;
};

export const externalAlphaIsTypeOf = defineIsTypeOf<ExternalAlpha>((value) => {
  return typeof value === "object" && value !== null && "label" in value;
});

export const externalBetaIsTypeOf = defineIsTypeOf<ExternalBeta>((value) => {
  return typeof value === "object" && value !== null && "score" in value;
});
