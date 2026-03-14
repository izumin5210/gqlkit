import { createServer } from "node:http";
import { openai } from "@ai-sdk/openai";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createYoga } from "graphql-yoga";
import { createResolvers } from "./gqlkit/__generated__/resolvers.js";
import { typeDefs } from "./gqlkit/__generated__/typeDefs.js";
import type { Context } from "./gqlkit/context.js";

const resolvers = createResolvers();

const schema = makeExecutableSchema({ typeDefs, resolvers });

const yoga = createYoga<Record<string, never>, Context>({
  schema,
  context: () => ({ model: openai("gpt-5-mini") }),
});
const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Server is running on http://localhost:4000/graphql");
});
