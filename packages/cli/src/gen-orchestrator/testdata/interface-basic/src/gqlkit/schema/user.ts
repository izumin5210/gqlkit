import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

/**
 * A user in the system.
 */
export type User = GqlObject<
  {
    id: IDString;
    name: string;
    email: string | null;
  },
  { implements: [Node] }
>;
