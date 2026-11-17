import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Key } from "@gqlkit-ts/runtime/federation";
import { defineQuery } from "../gqlkit.js";

/** Federation directives need the `federation` config. */
export type User = GqlObject<{ id: IDString }, { directives: [Key<"id">] }>;

export const user = defineQuery<{ id: IDString }, User | null>(() => null);
