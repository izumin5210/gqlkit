import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import { defineIsTypeOf } from "../gqlkit.js";
import type { Node } from "./node.js";

export type User = GqlObject<
  {
    id: IDString;
    name: string;
    email: string;
  },
  { implements: [Node] }
>;

export const userIsTypeOf = defineIsTypeOf<User>((value) => {
  return typeof value === "object" && value !== null && "email" in value;
});
