import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Content } from "./types.js";

export const contentQuery = defineQuery<Content[], NoArgs>(
  "content",
  (_args, _ctx) => {
    return [{ type: "text", subType: "plain", bodyA: "hello" }];
  },
);
