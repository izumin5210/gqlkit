import type { GqlInterface, GqlObject, NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery, defineResolveType } from "../gqlkit.js";

export type Shape = GqlInterface<{
  points: number[][];
}>;

export const shapeResolveType = defineResolveType<Shape>(() => "Polygon");

/** Widens the inner list of `points` to nullable, which `Shape` forbids */
export type Polygon = GqlObject<
  {
    points: (number[] | null)[];
  },
  { implements: [Shape] }
>;

export const polygon = defineQuery<NoArgs, Polygon>(() => ({
  points: [[0, 0]],
}));
