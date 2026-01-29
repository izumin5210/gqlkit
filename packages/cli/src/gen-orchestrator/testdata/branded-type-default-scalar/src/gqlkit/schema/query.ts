import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Product } from "./types.js";

export const products = defineQuery<NoArgs, Product[]>(() => []);
