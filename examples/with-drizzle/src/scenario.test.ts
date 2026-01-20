import { makeExecutableSchema } from "@graphql-tools/schema";
import { type DocumentNode, execute, type GraphQLSchema, parse } from "graphql";
import { GraphQLDateTime } from "graphql-scalars";
import { beforeAll, describe, expect, it } from "vitest";
import { db, pushSchema } from "./db/db.js";
import { createResolvers } from "./gqlkit/__generated__/resolvers.js";
import { typeDefs } from "./gqlkit/__generated__/typeDefs.js";
import type { Context } from "./gqlkit/context.js";

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

describe("with-drizzle scenario tests", () => {
  let schema: GraphQLSchema;
  let context: Context;

  beforeAll(async () => {
    await pushSchema();
    schema = createTestSchema();
    context = { db };
  });

  it("mutation creates data and query retrieves it with relations", async () => {
    const createUserResult = await executeGraphQL<{
      createUser: {
        id: string;
        name: string;
        status: string;
        createdAt: string;
      };
    }>(
      schema,
      context,
      /* GraphQL */ `
      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
          id
          name
          status
          createdAt
        }
      }
    `,
      {
        input: { name: "Alice", email: "alice@example.com", status: "active" },
      },
    );
    expect(createUserResult.errors).toBeUndefined();
    const userId = createUserResult.data!.createUser.id;

    const createPostResult = await executeGraphQL<{
      createPost: {
        id: string;
        title: string;
        priority: string;
        createdAt: string;
      };
    }>(
      schema,
      context,
      /* GraphQL */ `
      mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          id
          title
          priority
          createdAt
        }
      }
    `,
      {
        input: {
          title: "Hello World",
          content: "Content",
          priority: "high",
          authorId: userId,
        },
      },
    );
    const postId = createPostResult.data!.createPost.id;

    const result = await executeGraphQL<{
      user: {
        id: string;
        name: string;
        status: string;
        createdAt: string;
        posts: Array<{
          id: string;
          title: string;
          priority: string;
          createdAt: string;
          author: { name: string };
        }>;
      };
    }>(
      schema,
      context,
      /* GraphQL */ `
      query GetUserWithPosts($id: String!) {
        user(id: $id) {
          id
          name
          status
          createdAt
          posts {
            id
            title
            priority
            createdAt
            author { name }
          }
        }
      }
    `,
      { id: userId },
    );

    expect(result.data?.user).toMatchObject({
      id: userId,
      name: "Alice",
      status: "active",
      posts: [
        {
          id: postId,
          title: "Hello World",
          priority: "high",
          author: { name: "Alice" },
        },
      ],
    });
  });
});
