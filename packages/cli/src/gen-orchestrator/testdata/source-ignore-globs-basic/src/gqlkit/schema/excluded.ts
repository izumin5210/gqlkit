import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

// This file is excluded via `sourceIgnoreGlobs: ["excluded.ts"]` in
// config.json. Neither `ExcludedType` nor `excludedQuery` should appear
// anywhere in the generated output — that absence is what this golden case
// proves.
export interface ExcludedType {
  id: string;
  secret: string;
}

export const excludedQuery = defineQuery<NoArgs, ExcludedType | null>(
  () => null,
);
