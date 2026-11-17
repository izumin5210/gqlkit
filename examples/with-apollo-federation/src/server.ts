import { composeSupergraph, createGatewaySchema } from "./gateway.js";
import { serve } from "./serve.js";
import { createSubgraphs } from "./subgraphs.js";

const subgraphPorts = { users: 4001, posts: 4002 } as const;

const endpoints = await Promise.all(
  createSubgraphs().map(async (subgraph) => {
    const server = await serve(subgraph.schema, subgraphPorts[subgraph.name]);
    console.log(`Subgraph ${subgraph.name} is running on ${server.url}`);
    return { name: subgraph.name, sdl: subgraph.sdl, url: server.url };
  }),
);

const gateway = await serve(
  createGatewaySchema(composeSupergraph(endpoints)),
  4000,
);
console.log(`Gateway is running on ${gateway.url}`);
