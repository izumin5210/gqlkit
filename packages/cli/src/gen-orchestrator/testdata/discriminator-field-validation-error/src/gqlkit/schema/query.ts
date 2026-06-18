import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { ContentPart, Media } from "./types.js";

export const contentQuery = defineQuery<ContentPart[], NoArgs>(
  "content",
  (_args, _ctx) => {
    return [{ type: "text", text: "hello" }];
  },
);

export const mediaQuery = defineQuery<Media[], NoArgs>(
  "media",
  (_args, _ctx) => {
    return [{ kind: "audio", url: "https://example.com/audio.mp3" }];
  },
);
