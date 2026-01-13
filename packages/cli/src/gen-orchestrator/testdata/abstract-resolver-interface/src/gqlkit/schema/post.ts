import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

export type Post = GqlObject<
  {
    id: IDString;
    title: string;
  },
  { implements: [Node] }
>;
