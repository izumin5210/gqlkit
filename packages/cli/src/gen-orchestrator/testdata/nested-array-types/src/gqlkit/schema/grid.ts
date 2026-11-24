import type { GqlInterface, GqlObject, NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineQuery, defineResolveType } from "../gqlkit.js";

export type Cell = { value: string };

export type Shape = GqlInterface<{
  /** Implementations may narrow every nullable level of a nested list */
  points: ((number | null)[] | null)[] | null;
}>;

export const shapeResolveType = defineResolveType<Shape>(() => "Grid");

export type Grid = GqlObject<
  {
    rows: string[][];
    numbers: number[][];
    cells: Cell[][];
    nullableRows: (string | null)[][] | null;
    nullableInnerLists: (string[] | null)[];
    cubes: number[][][];
    mixedCubes: ((number | null)[] | null)[][] | null;
    points: number[][];
  },
  { implements: [Shape] }
>;

export type MatrixInput = {
  values: number[][];
  optionalValues?: (number | null)[][] | null;
  cells: CellInput[][];
};

export type CellInput = { value: string };

export const grid = defineQuery<NoArgs, Grid>(() => ({
  rows: [["a", "b"], ["c"]],
  numbers: [[1, 2], [3]],
  cells: [[{ value: "a" }]],
  nullableRows: [["a", null]],
  nullableInnerLists: [["a"], null],
  cubes: [[[1]]],
  mixedCubes: [[[1, null], null]],
  points: [[0, 0]],
}));

export const sum = defineQuery<{ matrix: number[][] }, number>(
  (_root, { matrix }) => matrix.flat().reduce((a, b) => a + b, 0),
);

export const sumInput = defineQuery<{ input: MatrixInput }, number>(
  (_root, { input }) => input.values.flat().reduce((a, b) => a + b, 0),
);

export const transposed = defineField<
  Grid,
  { by: (string | null)[][] | null },
  string[][]
>((parent) => parent.rows);
