import type { GqlObject, Int, NoArgs } from "@gqlkit-ts/runtime";
import type { Key } from "@gqlkit-ts/runtime/federation";
import { defineField } from "../gqlkit.js";

/**
 * A subgraph that only adds fields to an entity has no root fields of its
 * own; the gateway reaches it through `_entities` alone.
 */
export type Product = GqlObject<{ upc: string }, { directives: [Key<"upc">] }>;

/**
 * Every declared field is in the key, so the reference itself serves as
 * the Product and no reference resolver is needed.
 */
export const inStock = defineField<Product, NoArgs, Int>(() => 3 as Int);
