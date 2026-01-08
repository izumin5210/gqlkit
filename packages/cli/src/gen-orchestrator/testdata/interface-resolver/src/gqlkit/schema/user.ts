import type { GqlTypeDef, IDString } from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

/**
 * A user in the system.
 */
export type User = GqlTypeDef<
  {
    id: IDString;
    name: string;
    email: string | null;
  },
  { implements: [Node] }
>;
