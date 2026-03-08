import { defineIsTypeOf } from "../gqlkit.js";

// These type aliases are NOT exported from schema - they are "external" types
// that should be transitively discovered when used as union members.
type PartA = {
  value: string;
};

type PartB = {
  count: number;
};

/**
 * Container with items as a union of type alias members.
 * PartA and PartB should be discovered and registered
 * as separate GraphQL types with their original alias names.
 */
export type Container = {
  items: Array<PartA | PartB>;
};

export const partAIsTypeOf = defineIsTypeOf<PartA>((value) => {
  return typeof value === "object" && value !== null && "value" in value;
});

export const partBIsTypeOf = defineIsTypeOf<PartB>((value) => {
  return typeof value === "object" && value !== null && "count" in value;
});
