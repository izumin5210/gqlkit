import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Key } from "@gqlkit-ts/runtime/federation";
import { defineQuery, defineResolveReference } from "../gqlkit.js";

/** Federation directives and reference resolvers need the `federation` config. */
export type User = GqlObject<{ id: IDString }, { directives: [Key<"id">] }>;

export const userReference = defineResolveReference<User>((ref) => ({
  id: ref.id,
}));

export const user = defineQuery<{ id: IDString }, User | null>(() => null);
