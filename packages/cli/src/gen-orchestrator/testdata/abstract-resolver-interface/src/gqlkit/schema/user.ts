import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";

export type User = GqlObject<
  {
    id: IDString;
    name: string;
  },
  { implements: [Node] }
>;
