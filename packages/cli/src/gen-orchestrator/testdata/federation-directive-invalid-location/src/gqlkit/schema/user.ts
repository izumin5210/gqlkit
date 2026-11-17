import type { GqlField, IDString } from "@gqlkit-ts/runtime";
import type { Key, Shareable } from "@gqlkit-ts/runtime/federation";
import { defineQuery } from "../gqlkit.js";

export type User = {
  /** `@key` applies to object types only. */
  id: GqlField<IDString, { directives: [Key<"id">] }>;
};

export const user = defineQuery<
  {
    /** `@shareable` applies to object types and fields only. */
    id: GqlField<IDString, { directives: [Shareable] }>;
  },
  User | null
>(() => null);
