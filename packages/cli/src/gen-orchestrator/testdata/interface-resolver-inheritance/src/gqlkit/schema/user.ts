import type { GqlObject, IDString, NoArgs } from "@gqlkit-ts/runtime";
import { defineField } from "../gqlkit.js";
import type { Node } from "./node.js";

export type User = GqlObject<
  {
    id: IDString;
    name: string;
    kind: string;
  },
  { implements: [Node] }
>;

export const label = defineField<User, NoArgs, string>((user) => user.name);
