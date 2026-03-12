import { openai } from "@ai-sdk/openai";
import type { InferUIMessageChunk } from "ai";
import { readUIMessageStream, streamText } from "ai";
import type { AppMessage } from "../../agent.js";
import { tools } from "../../agent.js";
import { defineSubscription } from "../gqlkit.js";
import type { Message } from "./message.js";

// The chunk type yielded by toUIMessageStream()
export type ChatStreamChunk = InferUIMessageChunk<AppMessage>;

function callStreamText(prompt: string) {
  return streamText({
    model: openai("gpt-5-mini"),
    prompt,
    tools,
  });
}

// Raw stream: yields each UIMessageChunk as it arrives
export const chatStream = defineSubscription<
  { prompt: string },
  ChatStreamChunk
>(async (_root, args) => {
  const result = callStreamText(args.prompt);
  return result.toUIMessageStream<AppMessage>();
});

// Assembled UIMessage: yields the progressively-built Message on each update
export const chat = defineSubscription<{ prompt: string }, Message>(
  async (_root, args) => {
    const result = callStreamText(args.prompt);
    return readUIMessageStream<AppMessage>({
      stream: result.toUIMessageStream(),
    });
  },
);
