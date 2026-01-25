import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

/**
 * A user implementing Node with some internal fields excluded.
 */
export type User = GqlObject<
  {
    id: IDString;
    name: string;
    email: string | null;
    internalId: string;
    cacheKey: string;
  },
  { implements: [Node]; ignoreFields: "internalId" | "cacheKey" }
>;
