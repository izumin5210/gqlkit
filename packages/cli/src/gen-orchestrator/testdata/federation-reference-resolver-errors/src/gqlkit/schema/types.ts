import type { GqlObject, IDString, NoArgs } from "@gqlkit-ts/runtime";
import type { Key } from "@gqlkit-ts/runtime/federation";
import { defineQuery, defineResolveReference } from "../gqlkit.js";

/** Its references carry only `id`, so `name` needs a reference resolver. */
export type User = GqlObject<
  { id: IDString; name: string },
  { directives: [Key<"id">] }
>;

/** Only referenced here; another subgraph resolves it. */
export type Organization = GqlObject<
  { id: IDString },
  { directives: [Key<"id", { resolvable: false }>] }
>;

export type Team = { id: IDString; organization: Organization };

export const organizationReference = defineResolveReference<Organization>(
  (ref) => ({ id: ref.id }),
);

export const teamReference = defineResolveReference<Team>(() => null);

export const team = defineQuery<NoArgs, Team | null>(() => null);
export const user = defineQuery<NoArgs, User | null>(() => null);
