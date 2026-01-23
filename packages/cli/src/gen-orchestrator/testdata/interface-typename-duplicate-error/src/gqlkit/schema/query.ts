import { defineQuery } from "../gqlkit.js";
import type { Node } from "./types.js";

export const node = defineQuery<{ id: string }, Node>((_root, args) => ({
  __typename: "Person",
  id: args.id,
  name: "Test",
}));
