import { getStitchedSchemaFromSupergraphSdl } from "@graphql-tools/federation";
import { composeServices } from "@theguild/federation-composition";
import { type GraphQLSchema, parse } from "graphql";

export interface SubgraphEndpoint {
  readonly name: string;
  readonly sdl: string;
  readonly url: string;
}

/** Composes the subgraph SDLs into a supergraph, as a build step would. */
export function composeSupergraph(
  subgraphs: ReadonlyArray<SubgraphEndpoint>,
): string {
  const result = composeServices(
    subgraphs.map((subgraph) => ({
      name: subgraph.name,
      typeDefs: parse(subgraph.sdl),
      url: subgraph.url,
    })),
  );
  if (result.errors !== undefined && result.errors.length > 0) {
    throw new Error(
      `composition failed:\n${result.errors.map((e) => e.message).join("\n")}`,
    );
  }
  if (result.supergraphSdl === undefined) {
    throw new Error("composition produced no supergraph");
  }
  return result.supergraphSdl;
}

/** A gateway schema that calls each subgraph over HTTP. */
export function createGatewaySchema(supergraphSdl: string): GraphQLSchema {
  return getStitchedSchemaFromSupergraphSdl({ supergraphSdl });
}
