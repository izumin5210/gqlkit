import { readFileSync } from "node:fs";
import { makeExecutableSchema } from "@graphql-tools/schema";
import type { GraphQLSchema } from "graphql";
import { createResolvers as createPostsResolvers } from "../subgraphs/posts/src/gqlkit/__generated__/resolvers.js";
import { typeDefs as postsTypeDefs } from "../subgraphs/posts/src/gqlkit/__generated__/typeDefs.js";
import { createResolvers as createUsersResolvers } from "../subgraphs/users/src/gqlkit/__generated__/resolvers.js";
import { typeDefs as usersTypeDefs } from "../subgraphs/users/src/gqlkit/__generated__/typeDefs.js";

export type SubgraphName = "users" | "posts";

export interface Subgraph {
  readonly name: SubgraphName;
  readonly schema: GraphQLSchema;
  /** The SDL gqlkit generated for composition. */
  readonly sdl: string;
}

function readSdl(name: SubgraphName): string {
  return readFileSync(
    new URL(
      `../subgraphs/${name}/src/gqlkit/__generated__/schema.graphql`,
      import.meta.url,
    ),
    "utf-8",
  );
}

export function createSubgraphs(): ReadonlyArray<Subgraph> {
  return [
    {
      name: "users",
      schema: makeExecutableSchema({
        typeDefs: usersTypeDefs,
        resolvers: createUsersResolvers(),
      }),
      sdl: readSdl("users"),
    },
    {
      name: "posts",
      schema: makeExecutableSchema({
        typeDefs: postsTypeDefs,
        resolvers: createPostsResolvers(),
      }),
      sdl: readSdl("posts"),
    },
  ];
}
