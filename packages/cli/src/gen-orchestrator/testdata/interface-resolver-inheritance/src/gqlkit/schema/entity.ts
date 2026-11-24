import type { GqlInterface, IDString } from "@gqlkit-ts/runtime";
import { defineResolveType } from "../gqlkit.js";
import type { Node } from "./node.js";

export type Entity = GqlInterface<
  {
    id: IDString;
    createdAt: string;
  },
  { implements: [Node] }
>;

export const entityResolveType = defineResolveType<Entity>(() => "Post");
