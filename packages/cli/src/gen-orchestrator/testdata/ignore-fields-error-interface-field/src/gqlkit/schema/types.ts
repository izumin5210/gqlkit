import type { GqlInterface, GqlObject, IDString } from "@gqlkit-ts/runtime";
import { defineResolveType } from "../gqlkit.js";

export type Node = GqlInterface<{
  id: IDString;
}>;

export const nodeResolveType = defineResolveType<Node>(() => "User");

export type User = GqlObject<
  {
    id: IDString;
    name: string;
    email: string | null;
    internalId: string;
  },
  { ignoreFields: "id" | "internalId"; implements: [Node] }
>;
