import { defineIsTypeOf } from "../gqlkit.js";

// These interfaces are NOT exported from schema - they are "external" types
// that should be transitively discovered when used as union members.
interface ExternalPartA {
  value: string;
}

interface ExternalPartB {
  count: number;
}

/**
 * Container with items as a union of external types.
 * ExternalPartA and ExternalPartB should be discovered and registered
 * as separate GraphQL types with their original names.
 */
export type Container = {
  items: Array<ExternalPartA | ExternalPartB>;
};

export const externalPartAIsTypeOf = defineIsTypeOf<ExternalPartA>((value) => {
  return typeof value === "object" && value !== null && "value" in value;
});

export const externalPartBIsTypeOf = defineIsTypeOf<ExternalPartB>((value) => {
  return typeof value === "object" && value !== null && "count" in value;
});
