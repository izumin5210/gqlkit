import { defineQuery } from "../gqlkit.js";
import type { ContentPart, Media } from "./types.js";

export const contentQuery = defineQuery<{ id: string }, ContentPart>(
  "content",
  (_args, _ctx) => {
    return { type: "text" as const, text: "hello" };
  },
);

export const mediaQuery = defineQuery<{ id: string }, Media>(
  "media",
  (_args, _ctx) => {
    return { kind: "audio" as const, url: "https://example.com/audio.mp3" };
  },
);
