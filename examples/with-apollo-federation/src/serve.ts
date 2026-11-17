import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { GraphQLSchema } from "graphql";
import { createYoga } from "graphql-yoga";

export interface RunningServer {
  readonly url: string;
  close(): Promise<void>;
}

/** Serves a schema over HTTP; port 0 picks a free port. */
export async function serve(
  schema: GraphQLSchema,
  port: number,
): Promise<RunningServer> {
  const yoga = createYoga({ schema, logging: false });
  const server = createServer(yoga);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const address = server.address() as AddressInfo;
  return {
    url: `http://localhost:${address.port}${yoga.graphqlEndpoint}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
