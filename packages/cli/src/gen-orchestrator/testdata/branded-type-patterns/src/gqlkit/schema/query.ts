import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { BrandedPatterns } from "./types.js";

export const patterns = defineQuery<NoArgs, BrandedPatterns>(() => ({
  simple: "" as never,
  uniqueSymbol: "" as never,
  multiMarker: "" as never,
  numBrand: 0 as never,
  boolNominal: false as never,
  singleUnderscore: "" as never,
  noPrefix: "" as never,
}));
