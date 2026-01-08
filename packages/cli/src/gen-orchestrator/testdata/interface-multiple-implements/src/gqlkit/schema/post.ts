import type { GqlTypeDef, IDString } from "@gqlkit-ts/runtime";
import type { DateTime, Node, Timestamped } from "./interfaces.js";

/**
 * A blog post with multiple interface implementations.
 */
export type Post = GqlTypeDef<
  {
    id: IDString;
    title: string;
    content: string;
    createdAt: DateTime;
    updatedAt: DateTime;
  },
  { implements: [Node, Timestamped] }
>;
