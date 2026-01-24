import { createServer } from "node:http";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLDateTime } from "graphql-scalars";
import { createYoga } from "graphql-yoga";
import { prisma } from "./db/db.js";
import { createResolvers } from "./gqlkit/__generated__/resolvers.js";
import { typeDefs } from "./gqlkit/__generated__/typeDefs.js";
import type { Context } from "./gqlkit/context.js";

async function main() {
  const resolvers = createResolvers({
    scalars: {
      DateTime: GraphQLDateTime,
    },
  });
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const yoga = createYoga<object, Context>({
    schema,
    context: () => ({ db: prisma }),
  });

  const server = createServer(yoga);

  server.listen(4000, () => {
    console.log("Server is running on http://localhost:4000/graphql");
  });
}

main().catch(console.error);
