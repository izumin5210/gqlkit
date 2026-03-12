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
>(async function* (_root, args) {
  const result = callStreamText(args.prompt);
  for await (const chunk of result.toUIMessageStream<AppMessage>()) {
    yield chunk;
  }
});

// Assembled UIMessage: yields the progressively-built Message on each update
export const chat = defineSubscription<{ prompt: string }, Message>(
  async function* (_root, args) {
    const result = callStreamText(args.prompt);
    for await (const message of readUIMessageStream<AppMessage>({
      stream: result.toUIMessageStream(),
    })) {
      yield message;
    }
  },
);
