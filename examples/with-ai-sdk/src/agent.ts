import type { InferUITools, ToolSet, UIMessage } from "ai";
import { tool } from "ai";
import { z } from "zod";

// Tool definitions
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

// Derive UI types from tool definitions
export type AppTools = InferUITools<typeof tools>;

export type AppMetadata = {
  model: string;
  timestamp: number;
};

// Custom data parts for structured UI rendering
export type AppData = {
  chart: { labels: string[]; values: number[] };
  suggestion: { text: string; confidence: number };
};

// The concrete UIMessage — the single source of truth
export type AppMessage = UIMessage<AppMetadata, AppData, AppTools>;
