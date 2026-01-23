import { defineQuery } from "../gqlkit.js";
import type { Node } from "./types.js";

export const nodeQuery = defineQuery<Node | null, { id: string }>(
  "node",
  (_args, _ctx) => {
    return { $typeName: "User", id: "1", name: "Test User" };
  },
);
