import { defineQuery } from "../gqlkit.js";
import type { ContentPart, Media } from "./types.js";

export const contentQuery = defineQuery<ContentPart, { id: string }>(
  "content",
  (_args, _ctx) => {
    return { type: "text" as const, text: "hello" };
  },
);

export const mediaQuery = defineQuery<Media, { id: string }>(
  "media",
  (_args, _ctx) => {
    return { kind: "audio" as const, url: "https://example.com/audio.mp3" };
  },
);
