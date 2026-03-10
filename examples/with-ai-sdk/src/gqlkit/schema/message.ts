import type { NoArgs } from "@gqlkit-ts/runtime";
import type { AppMessage } from "../../agent.js";
import { defineQuery } from "../gqlkit.js";

// Re-export AppMessage as Message — gqlkit discovers UIMessage fields transitively.
// No need to manually re-define Part types or union members.
export type Message = AppMessage;

// -- Mock data --

const mockMessages: Message[] = [
  {
    id: "1",
    role: "user",
    parts: [{ type: "text", text: "What is the weather in Tokyo?" }],
  },
  {
    id: "2",
    role: "assistant",
    metadata: { model: "gpt-4o", timestamp: 1709500000 },
    parts: [
      { type: "text", text: "Let me check the weather for you." },
      { type: "step-start" },
    ],
  },
];

// -- Queries --

export const messages = defineQuery<NoArgs, Message[]>(() => mockMessages);
export const message = defineQuery<{ id: string }, Message | null>(
  (_root, args) => mockMessages.find((m) => m.id === args.id) ?? null,
);
