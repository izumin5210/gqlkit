import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Key } from "@gqlkit-ts/runtime/federation";
import { defineQuery } from "../gqlkit.js";

/** Referenced by this subgraph and resolved by another one. */
export type Organization = GqlObject<
  { id: IDString },
  { directives: [Key<"id", { resolvable: false }>] }
>;

/** An entity with two keys, one of them nested. */
export type User = GqlObject<
  { id: IDString; organization: Organization; name: string },
  { directives: [Key<"id">, Key<"organization { id }">] }
>;

/**
 * An alias of a federation directive is neither a schema type nor a
 * custom directive definition.
 */
export type ProductKey = Key<"upc">;

/**
 * No root field reaches this entity, but pruning keeps it: the gateway
 * reaches entities through the subgraph's entity resolution instead.
 */
export type Product = GqlObject<
  { upc: string; name: string },
  { directives: [ProductKey] }
>;

export const user = defineQuery<{ id: IDString }, User | null>(() => null);
