import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { DateTime, Entity } from "./interfaces.js";

/**
 * An article implementing the Entity interface.
 */
export type Article = GqlObject<
  {
    id: IDString;
    title: string;
    body: string;
    createdAt: DateTime;
    updatedAt: DateTime;
  },
  { implements: [Entity] }
>;
