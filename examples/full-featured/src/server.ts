import { createServer } from "node:http";
import { GraphQLScalarType, Kind } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createYoga } from "graphql-yoga";
import { createResolvers } from "./gqlkit/__generated__/resolvers.js";
import { typeDefs } from "./gqlkit/__generated__/typeDefs.js";

import type { DateTime } from "./gqlkit/schema/scalars.js";

const DateTimeScalar = new GraphQLScalarType<DateTime, DateTime>({
  name: "DateTime",
  description: "ISO 8601 date-time string",
  serialize(value) {
    return value as DateTime;
  },
  parseValue(value) {
    return value as DateTime;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return ast.value as DateTime;
    }
    throw new Error("DateTime must be a string");
  },
});

const resolvers = createResolvers({
  scalars: {
    DateTime: DateTimeScalar,
  },
});

const schema = makeExecutableSchema({ typeDefs, resolvers });

const yoga = createYoga({ schema });
const server = createServer(yoga);

server.listen(4000, () => {
  console.log("Server is running on http://localhost:4000/graphql");
});
