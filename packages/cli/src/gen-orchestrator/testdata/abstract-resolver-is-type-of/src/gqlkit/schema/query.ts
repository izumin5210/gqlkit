import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Animal } from "./types.js";

export const animals = defineQuery<NoArgs, Animal[]>(() => []);
