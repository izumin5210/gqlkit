import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Key } from "@gqlkit-ts/runtime/federation";

/**
 * Posts subgraph only references User by its key; the gateway fetches the
 * other fields from the users subgraph.
 */
export type User = GqlObject<
  { id: IDString },
  { directives: [Key<"id", { resolvable: false }>] }
>;
