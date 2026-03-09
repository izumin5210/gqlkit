import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { ContentPart } from "./types.js";

export const contentQuery = defineQuery<ContentPart, NoArgs>(
  "content",
  (_args, _ctx) => {
    return { type: "text", text: "hello" } as ContentPart;
  },
);
