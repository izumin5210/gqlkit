import type { GqlObject } from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

/**
 * A user that claims to implement Node but is missing the id field.
 */
export type User = GqlObject<
  {
    name: string;
    email: string | null;
  },
  { implements: [Node] }
>;
