import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { ExistingType } from "./types.js";

export const existing = defineQuery<NoArgs, ExistingType[]>(() => []);
