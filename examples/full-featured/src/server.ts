import { createServer } from "node:http";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createYoga } from "graphql-yoga";
import { GraphQLDateTime } from "graphql-scalars";
import { createResolvers } from "./gqlkit/__generated__/resolvers.js";
import { typeDefs } from "./gqlkit/__generated__/typeDefs.js";

const resolvers = createResolvers({
  scalars: {
    DateTime: GraphQLDateTime,
  },
});

const schema = makeExecutableSchema({ typeDefs, resolvers });

const yoga = createYoga({ schema });
const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Server is running on http://localhost:4000/graphql");
});
