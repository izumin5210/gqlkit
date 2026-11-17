import type { GqlObject, IDString, NoArgs } from "@gqlkit-ts/runtime";
import type { Key } from "@gqlkit-ts/runtime/federation";
import {
  defineField,
  defineIsTypeOf,
  defineQuery,
  defineResolveReference,
} from "../gqlkit.js";

export type User = GqlObject<
  { id: IDString; name: string },
  { directives: [Key<"id">] }
>;

/** Resolves a User from the reference the gateway sends. */
export const userReference = defineResolveReference<User>((ref) => ({
  id: ref.id,
  name: "Alice",
}));

/** A type can have a reference resolver next to other type resolvers. */
export const userIsTypeOf = defineIsTypeOf<User>(
  (value) => typeof value === "object" && value !== null && "name" in value,
);

export const displayName = defineField<User, NoArgs, string>(
  (parent) => parent.name,
);

export const me = defineQuery<NoArgs, User | null>(() => null);
