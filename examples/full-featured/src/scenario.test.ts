import { makeExecutableSchema } from "@graphql-tools/schema";
import {
  type DocumentNode,
  type ExecutionResult,
  execute,
  type GraphQLSchema,
  parse,
  subscribe,
} from "graphql";
import { GraphQLDateTime } from "graphql-scalars";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createResolvers } from "./gqlkit/__generated__/resolvers.js";
import { typeDefs } from "./gqlkit/__generated__/typeDefs.js";
import type { Context } from "./gqlkit/context.js";
import { PubSub } from "./pubsub.js";

function createTestSchema(): GraphQLSchema {
  const resolvers = createResolvers({
    scalars: { DateTime: GraphQLDateTime },
  });
  return makeExecutableSchema({ typeDefs, resolvers });
}

async function executeGraphQL<T>(
  schema: GraphQLSchema,
  contextValue: Context,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data?: T | null; errors?: readonly { message: string }[] }> {
  const document: DocumentNode = parse(query);
  const result = await execute({
    schema,
    document,
    contextValue,
    variableValues: variables,
  });
  return result as { data?: T | null; errors?: readonly { message: string }[] };
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

describe("full-featured scenario tests", () => {
  let schema: GraphQLSchema;
  let context: Context;

  beforeAll(() => {
    schema = createTestSchema();
  });

  beforeEach(() => {
    context = {
      currentUserId: "user-1",
      pubsub: new PubSub(),
    };
  });

  it("postCreated: receives event when a post is created", async () => {
    const iterator = await subscribeGraphQL(
      schema,
      context,
      /* GraphQL */ `
        subscription {
          postCreated {
            id
            title
            body
          }
        }
      `,
    );

    const nextPromise = iterator.next();

    await executeGraphQL(
      schema,
      context,
      /* GraphQL */ `
        mutation {
          createPost(input: { title: "New Post", body: "Hello world" }) {
            id
          }
        }
      `,
    );

    const { value, done } = await nextPromise;
    expect(done).toBeFalsy();
    expect(value.errors).toBeUndefined();
    expect(value.data).toMatchObject({
      postCreated: {
        title: "New Post",
        body: "Hello world",
      },
    });
    expect(value.data.postCreated.id).toBeDefined();

    await iterator.return!();
  });

  it("commentAdded: receives event when a comment is added", async () => {
    const iterator = await subscribeGraphQL(
      schema,
      context,
      /* GraphQL */ `
        subscription ($postId: String!) {
          commentAdded(postId: $postId) {
            id
            body
            postId
          }
        }
      `,
      { postId: "post-1" },
    );

    const nextPromise = iterator.next();

    await executeGraphQL(
      schema,
      context,
      /* GraphQL */ `
        mutation {
          addComment(input: { postId: "post-1", body: "Great post!" }) {
            id
          }
        }
      `,
    );

    const { value, done } = await nextPromise;
    expect(done).toBeFalsy();
    expect(value.errors).toBeUndefined();
    expect(value.data).toMatchObject({
      commentAdded: {
        body: "Great post!",
        postId: "post-1",
      },
    });
    expect(value.data.commentAdded.id).toBeDefined();

    await iterator.return!();
  });

  it("commentAdded: filters events by postId", async () => {
    const iterator = await subscribeGraphQL(
      schema,
      context,
      /* GraphQL */ `
        subscription ($postId: String!) {
          commentAdded(postId: $postId) {
            id
            body
            postId
          }
        }
      `,
      { postId: "post-2" },
    );

    // Comment on post-1 should not trigger event for post-2 subscriber
    await executeGraphQL(
      schema,
      context,
      /* GraphQL */ `
        mutation {
          addComment(input: { postId: "post-1", body: "Comment on post 1" }) {
            id
          }
        }
      `,
    );

    // Comment on post-2 should trigger event
    const nextPromise = iterator.next();

    await executeGraphQL(
      schema,
      context,
      /* GraphQL */ `
        mutation {
          addComment(input: { postId: "post-2", body: "Comment on post 2" }) {
            id
          }
        }
      `,
    );

    const { value, done } = await nextPromise;
    expect(done).toBeFalsy();
    expect(value.errors).toBeUndefined();
    expect(value.data).toMatchObject({
      commentAdded: {
        body: "Comment on post 2",
        postId: "post-2",
      },
    });

    await iterator.return!();
  });
});
