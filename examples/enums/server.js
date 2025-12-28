import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./src/gqlkit/generated/schema.js";
import { resolvers } from "./src/gqlkit/generated/resolvers.js";
const schema = makeExecutableSchema({ typeDefs, resolvers });
const yoga = createYoga({ schema });
const server = createServer(yoga);
server.listen(4000, () => {
    console.log("Server is running on http://localhost:4000/graphql");
});
//# sourceMappingURL=server.js.map