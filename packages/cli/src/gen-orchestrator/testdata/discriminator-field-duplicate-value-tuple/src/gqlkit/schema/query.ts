import { defineQuery } from "../gqlkit.js";
import type { Content } from "./types.js";

export const contentQuery = defineQuery<Content[], {}>(
  "content",
  (_args, _ctx) => {
    return [{ type: "text", subType: "plain", bodyA: "hello" }];
  },
);
