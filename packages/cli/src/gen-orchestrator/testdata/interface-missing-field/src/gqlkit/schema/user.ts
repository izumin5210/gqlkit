import type { GqlTypeDef } from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

/**
 * A user that claims to implement Node but is missing the id field.
 */
export type User = GqlTypeDef<
  {
    name: string;
    email: string | null;
  },
  { implements: [Node] }
>;
