import type { GqlInterface, IDString } from "@gqlkit-ts/runtime";
import { defineResolveType } from "../gqlkit.js";

export type Node = GqlInterface<{
  id: IDString;
}>;

export const nodeResolveType = defineResolveType<Node>((value) => {
  if ("name" in value) {
    return "User";
  }
  if ("title" in value) {
    return "Post";
  }
  return "User";
});
