import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Entity } from "./types.js";

/**
 * An article implementing the re-exported Entity interface.
 */
export type Article = GqlObject<
  {
    id: IDString;
    title: string;
    updatedAt: string;
  },
  { implements: [Entity] }
>;
