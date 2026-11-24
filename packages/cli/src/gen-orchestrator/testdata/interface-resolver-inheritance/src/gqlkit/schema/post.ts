import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Entity } from "./entity.js";

/**
 * Implements Node only through Entity.
 */
export type Post = GqlObject<
  {
    id: IDString;
    createdAt: string;
    title: string;
  },
  { implements: [Entity] }
>;
