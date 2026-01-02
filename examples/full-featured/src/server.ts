import { createServer } from "node:http";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createYoga } from "graphql-yoga";
import { resolvers } from "./gqlkit/generated/resolvers.js";
import { typeDefs } from "./gqlkit/generated/schema.js";

const schema = makeExecutableSchema({ typeDefs, resolvers });

const yoga = createYoga({ schema });
const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Server is running on http://localhost:4000/graphql");
});
