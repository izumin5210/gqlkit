---
title: Integration with Vercel AI SDK
description: Stream AI responses as GraphQL subscriptions using the Vercel AI SDK.
---

# Vercel AI SDK

The [Vercel AI SDK](https://ai-sdk.dev/) provides a unified API for working with large language models. gqlkit integrates with the AI SDK by automatically converting its rich message types — including tool invocations, step boundaries, and custom data parts — into GraphQL unions and subscriptions.

## Installation

```sh filename="npm"
npm install ai @ai-sdk/openai
```

```sh filename="pnpm"
pnpm add ai @ai-sdk/openai
```

```sh filename="yarn"
yarn add ai @ai-sdk/openai
```

## Defining Tools

Define AI tools using the AI SDK's `tool()` helper. The `ToolSet` and `InferUITools` types let you derive strongly-typed UI tool representations:

```typescript
// src/agent.ts
import type { InferUITools, ToolSet, UIMessage } from "ai";
import { tool } from "ai";
import { z } from "zod";

export const tools = {
  weather: tool({
    description: "Get current weather for a location",
    inputSchema: z.object({
      location: z.string().describe("City name"),
    }),
    execute: async ({ location }) => ({
      location,
      temperature: 72,
      condition: "sunny" as const,
    }),
  }),
  calculate: tool({
    description: "Calculate a math expression",
    inputSchema: z.object({
      expression: z.string().describe("Math expression"),
    }),
    execute: async ({ expression }) => ({
      expression,
      result: 42,
    }),
  }),
} satisfies ToolSet;

export type AppTools = InferUITools<typeof tools>;

export type AppMetadata = {
  model: string;
  timestamp: number;
};

export type AppData = {
  chart: { labels: string[]; values: number[] };
  suggestion: { text: string; confidence: number };
};

export type AppMessage = UIMessage<AppMetadata, AppData, AppTools>;
```

## Defining the Message Type

Re-export your `AppMessage` as a named type in the gqlkit schema directory. gqlkit discovers the `UIMessage` fields — including the `parts` union — transitively, so you don't need to manually define each part type:

```typescript
// src/gqlkit/schema/message.ts
import type { NoArgs } from "@gqlkit-ts/runtime";
import type { AppMessage } from "../../agent.js";
import { defineQuery } from "../gqlkit.js";

// Re-export AppMessage as Message — gqlkit discovers UIMessage fields transitively.
export type Message = AppMessage;

export const messages = defineQuery<NoArgs, Message[]>(() => mockMessages);
export const message = defineQuery<{ id: string }, Message | null>(
  (_root, args) => mockMessages.find((m) => m.id === args.id) ?? null,
);
```

The `parts` field on `UIMessage` is a discriminated union of text parts, tool invocations, tool results, step boundaries, source parts, file parts, reasoning parts, and your custom data parts. gqlkit automatically generates a corresponding GraphQL union type for this.

## Defining Subscriptions

The AI SDK provides two streaming patterns that map naturally to GraphQL subscriptions:

### Raw Stream (chunk-by-chunk)

Use `toUIMessageStream()` to yield each `UIMessageChunk` as it arrives:

```typescript
// src/gqlkit/schema/subscription.ts
import type { InferUIMessageChunk } from "ai";
import { streamText } from "ai";
import type { AppMessage } from "../../agent.js";
import { tools } from "../../agent.js";
import { defineSubscription } from "../gqlkit.js";

export type ChatStreamChunk = InferUIMessageChunk<AppMessage>;

export const chatStream = defineSubscription<
  { prompt: string },
  ChatStreamChunk
>(async (_root, args, ctx) => {
  const result = streamText({ model: ctx.model, prompt: args.prompt, tools });
  return result.toUIMessageStream<AppMessage>();
});
```

### Assembled Message (progressive updates)

Use `readUIMessageStream()` to yield the progressively-built `Message` on each update:

```typescript
import { readUIMessageStream, streamText } from "ai";
import type { AppMessage } from "../../agent.js";
import { tools } from "../../agent.js";
import { defineSubscription } from "../gqlkit.js";
import type { Message } from "./message.js";

export const chat = defineSubscription<{ prompt: string }, Message>(
  async (_root, args, ctx) => {
    const result = streamText({ model: ctx.model, prompt: args.prompt, tools });
    return readUIMessageStream<AppMessage>({
      stream: result.toUIMessageStream(),
    });
  },
);
```

## Discriminator Fields Configuration

The AI SDK's union types use discriminator fields that gqlkit needs to know about. Configure them in `gqlkit.config.ts`:

```typescript
// gqlkit.config.ts
import type { GqlkitConfig } from "@gqlkit-ts/cli";

const config: GqlkitConfig = {
  discriminatorFields: {
    // Message.parts union — discriminated by "type" with "state" as a secondary field
    MessageParts: ["type", "state"],
    // UIMessageChunk variants — discriminated by "type"
    ChatStreamChunk: ["type"],
  },
};

export default config;
```

The `discriminatorFields` option tells gqlkit which fields to use when generating the GraphQL union's `__resolveType` implementation.

## Context with Language Model

Inject the `LanguageModel` via context so resolvers stay testable and model-agnostic. For basic setup, see [Set Up Context and Resolver Factories](../getting-started.md#set-up-context-and-resolver-factories).

```typescript
// src/gqlkit/context.ts
import type { LanguageModel } from "ai";

export type Context = {
  model: LanguageModel;
};
```

## Complete Example

See the [examples/with-ai-sdk](https://github.com/gqlkit/gqlkit/tree/main/examples/with-ai-sdk) directory for a complete working example with:

- Tool definitions with Zod schemas
- `UIMessage` with custom metadata, data parts, and tool types
- Both streaming patterns (`chatStream` and `chat` subscriptions)
- Discriminator fields configuration

## Further Reading

- [AI SDK Documentation](https://ai-sdk.dev/docs)
- [AI SDK GitHub](https://github.com/vercel/ai)
