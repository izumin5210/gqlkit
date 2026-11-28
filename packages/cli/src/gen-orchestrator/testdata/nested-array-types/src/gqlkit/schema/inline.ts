import type { GqlDirective, GqlField, NoArgs } from "@gqlkit-ts/runtime";
import { defineIsTypeOf, defineQuery } from "../gqlkit.js";

export type BoundsDirective<TArgs extends { bounds: (number | null)[][] }> =
  GqlDirective<"bounds", TArgs, "FIELD_DEFINITION">;

type Tile = { kind: string };
type Marker = { label: string };

export type Board = {
  /** Inline objects nested in arrays get a generated type */
  squares: { color: string }[][];
  /** Inline enums nested in arrays get a generated enum */
  levels: ("LOW" | "HIGH")[][] | null;
  /** Inline unions nested in arrays get a generated union */
  pieces: (Tile | Marker)[][];
  bounded: GqlField<
    string,
    { directives: [BoundsDirective<{ bounds: [[0, null], [1, 2]] }>] }
  >;
};

export const board = defineQuery<NoArgs, Board>(() => ({
  squares: [[{ color: "black" }]],
  levels: [["LOW"]],
  pieces: [[{ kind: "pawn" }]],
  bounded: "",
}));

export const tileIsTypeOf = defineIsTypeOf<Tile>(
  (value) => typeof value === "object" && value !== null && "kind" in value,
);

export const markerIsTypeOf = defineIsTypeOf<Marker>(
  (value) => typeof value === "object" && value !== null && "label" in value,
);
