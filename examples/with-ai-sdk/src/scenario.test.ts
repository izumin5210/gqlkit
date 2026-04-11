import { makeExecutableSchema } from "@graphql-tools/schema";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import {
  type DocumentNode,
  type ExecutionResult,
  execute,
  GraphQLScalarType,
  type GraphQLSchema,
  parse,
  subscribe,
} from "graphql";
import { beforeAll, describe, expect, it } from "vitest";
import { createResolvers } from "./gqlkit/__generated__/resolvers.js";
import { typeDefs } from "./gqlkit/__generated__/typeDefs.js";
import type { Context } from "./gqlkit/context.js";

type StreamChunk =
  Awaited<
    ReturnType<MockLanguageModelV3["doStream"]>
  >["stream"] extends ReadableStream<infer T>
    ? T
    : never;

// Identity scalars — pass through any value as-is
const GraphQLJSON = new GraphQLScalarType({ name: "JSON" });
const GraphQLJSONObject = new GraphQLScalarType({ name: "JSONObject" });

function createTestSchema(): GraphQLSchema {
  return makeExecutableSchema({
    typeDefs,
    resolvers: [
      createResolvers(),
      {
        JSON: GraphQLJSON,
        JSONObject: GraphQLJSONObject,
      },
    ],
  });
}

function createTextStreamModel(): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Hello" },
          { type: "text-delta", id: "t1", delta: " world" },
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: "stop",
            usage: { inputTokens: {}, outputTokens: {} },
          },
        ] satisfies StreamChunk[],
      }),
    }),
  });
}

async function executeGraphQL(
  schema: GraphQLSchema,
  contextValue: Context,
  query: string,
  variables?: Record<string, unknown>,
): Promise<ExecutionResult> {
  const document: DocumentNode = parse(query);
  return execute({ schema, document, contextValue, variableValues: variables });
}

async function subscribeGraphQL(
  schema: GraphQLSchema,
  contextValue: Context,
  query: string,
  variables?: Record<string, unknown>,
): Promise<AsyncIterableIterator<ExecutionResult>> {
  const document: DocumentNode = parse(query);
  const result = await subscribe({
    schema,
    document,
    contextValue,
    variableValues: variables,
  });
  if (Symbol.asyncIterator in (result as object)) {
    return result as AsyncIterableIterator<ExecutionResult>;
  }
  throw new Error(
    `Expected AsyncIterableIterator but got: ${JSON.stringify(result)}`,
  );
}

async function collectAll(
  iterator: AsyncIterableIterator<ExecutionResult>,
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  for await (const item of iterator) {
    results.push(item);
  }
  return results;
}

describe("with-ai-sdk scenario tests", () => {
  let schema: GraphQLSchema;

  beforeAll(() => {
    schema = createTestSchema();
  });

  describe("Query", () => {
    it("messages: returns all messages", async () => {
      const model = new MockLanguageModelV3();
      const result = await executeGraphQL(
        schema,
        { model },
        /* GraphQL */ `
          query {
            messages {
              id
              role
              parts {
                __typename
                ... on MessagePartText {
                  text
                }
              }
            }
          }
        `,
      );

      expect(result.errors).toBeUndefined();
      expect(result.data).toMatchObject({
        messages: [
          {
            id: "1",
            role: "USER",
            parts: [
              {
                __typename: "MessagePartText",
                text: "What is the weather in Tokyo?",
              },
            ],
          },
          {
            id: "2",
            role: "ASSISTANT",
            parts: [
              {
                __typename: "MessagePartText",
                text: "Let me check the weather for you.",
              },
              { __typename: "MessagePartStepStart" },
            ],
          },
        ],
      });
    });

    it("message: returns a single message by id", async () => {
      const model = new MockLanguageModelV3();
      const result = await executeGraphQL(
        schema,
        { model },
        /* GraphQL */ `
          query ($id: String!) {
            message(id: $id) {
              id
              role
            }
          }
        `,
        { id: "1" },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data).toMatchObject({
        message: { id: "1", role: "USER" },
      });
    });

    it("message: returns null for non-existent id", async () => {
      const model = new MockLanguageModelV3();
      const result = await executeGraphQL(
        schema,
        { model },
        /* GraphQL */ `
          query ($id: String!) {
            message(id: $id) {
              id
            }
          }
        `,
        { id: "999" },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ message: null });
    });
  });

  describe("Subscription", () => {
    it("chatStream: streams text chunks from the model", async () => {
      const model = createTextStreamModel();

      const iterator = await subscribeGraphQL(
        schema,
        { model },
        /* GraphQL */ `
          subscription ($prompt: String!) {
            chatStream(prompt: $prompt) {
              __typename
              ... on ChatStreamChunkTextDelta {
                delta
              }
            }
          }
        `,
        { prompt: "Say hello" },
      );

      const chunks = await collectAll(iterator);

      const textDeltas = chunks
        .map(
          (c) => c.data?.["chatStream"] as Record<string, unknown> | undefined,
        )
        .filter((d) => d?.["__typename"] === "ChatStreamChunkTextDelta")
        .map((d) => d?.["delta"]);
      expect(textDeltas).toEqual(["Hello", " world"]);
    });

    it("chat: streams assembled messages", async () => {
      const model = createTextStreamModel();

      const iterator = await subscribeGraphQL(
        schema,
        { model },
        /* GraphQL */ `
          subscription ($prompt: String!) {
            chat(prompt: $prompt) {
              id
              role
              parts {
                __typename
                ... on MessagePartText {
                  text
                }
              }
            }
          }
        `,
        { prompt: "Greet me" },
      );

      const messages = await collectAll(iterator);

      // The last message should contain the fully assembled text
      const last = messages.at(-1);
      expect(last?.errors).toBeUndefined();
      const chat = last?.data?.["chat"] as Record<string, unknown>;
      expect(chat).toMatchObject({
        role: "ASSISTANT",
        parts: expect.arrayContaining([
          expect.objectContaining({
            __typename: "MessagePartText",
            text: "Hello world",
          }),
        ]),
      });
    });
  });
});
